#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include "offline_gateway.h"
#include <bcrypt.h>
#include <algorithm>
#include <cctype>
#include <chrono>
#include <cstdio>
#include <ctime>
#include <fstream>
#include <sstream>
#include <stdexcept>
#include <vector>

namespace {
std::string randomHex(size_t bytes) {
  std::vector<unsigned char> data(bytes);
  if (BCryptGenRandom(nullptr, data.data(), static_cast<ULONG>(data.size()), BCRYPT_USE_SYSTEM_PREFERRED_RNG) != 0) throw std::runtime_error("Falha ao criar credencial local");
  static const char* hex = "0123456789abcdef";
  std::string result; result.reserve(bytes * 2);
  for (auto value : data) { result.push_back(hex[value >> 4]); result.push_back(hex[value & 15]); }
  return result;
}
std::string trim(std::string value) {
  while (!value.empty() && std::isspace(static_cast<unsigned char>(value.front()))) value.erase(value.begin());
  while (!value.empty() && std::isspace(static_cast<unsigned char>(value.back()))) value.pop_back();
  return value;
}
std::string header(const std::string& request, const std::string& name) {
  std::istringstream lines(request); std::string line; const std::string target = name + ":";
  while (std::getline(lines, line)) { if (!line.empty() && line.back() == '\r') line.pop_back(); if (line.size() >= target.size() && _strnicmp(line.c_str(), target.c_str(), target.size()) == 0) return trim(line.substr(target.size())); }
  return {};
}
void sendJson(SOCKET socket, int status, const nlohmann::json& body) {
  const std::string payload = body.dump();
  const std::string label = status == 200 ? "OK" : status == 401 ? "Unauthorized" : status == 429 ? "Too Many Requests" : "Bad Request";
  std::ostringstream out; out << "HTTP/1.1 " << status << ' ' << label << "\r\nContent-Type: application/json; charset=utf-8\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: Content-Type, X-Fusion-Local-Token, X-Fusion-Pair-Code\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nContent-Length: " << payload.size() << "\r\nConnection: close\r\n\r\n" << payload;
  const auto response = out.str(); send(socket, response.data(), static_cast<int>(response.size()), 0);
}
}

OfflineGateway::OfflineGateway(FaceEngine& engine, std::filesystem::path baseDir, int port) : engine_(engine), baseDir_(std::move(baseDir)), port_(port) { loadState(); }
OfflineGateway::~OfflineGateway() { stop(); }
void OfflineGateway::start() { if (running_.exchange(true)) return; thread_ = std::thread([this]{ serve(); }); }
void OfflineGateway::stop() { if (!running_.exchange(false)) return; if (thread_.joinable()) thread_.detach(); }
std::string OfflineGateway::pairingCode() const { return pairingCode_; }

void OfflineGateway::loadState() {
  std::filesystem::create_directories(baseDir_ / "data");
  const auto tokenPath = baseDir_ / "data" / "local-token.txt";
  const auto codePath = baseDir_ / "data" / "pair-code.txt";
  std::ifstream tokenIn(tokenPath); std::getline(tokenIn, token_);
  std::ifstream codeIn(codePath); std::getline(codeIn, pairingCode_);
  if (token_.size() < 32) { token_ = randomHex(32); std::ofstream(tokenPath, std::ios::trunc) << token_; }
  if (pairingCode_.size() != 6) { const auto value = std::stoul(randomHex(4), nullptr, 16) % 1000000; char code[7]; std::snprintf(code, sizeof(code), "%06lu", value); pairingCode_ = code; std::ofstream(codePath, std::ios::trunc) << pairingCode_; }
  const auto rules = baseDir_ / "data" / "offline-rules.json";
  if (std::filesystem::exists(rules)) { try { std::ifstream in(rules); in >> snapshot_; } catch (...) { snapshot_ = nlohmann::json::object(); } }
}

void OfflineGateway::updateRules(const nlohmann::json& snapshot) {
  std::lock_guard<std::mutex> guard(mutex_); snapshot_ = snapshot;
  const auto temporary = baseDir_ / "data" / "offline-rules.tmp"; std::ofstream(temporary, std::ios::trunc) << snapshot_.dump();
  MoveFileExW(temporary.c_str(), (baseDir_ / "data" / "offline-rules.json").c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH);
}

void OfflineGateway::appendLine(const std::filesystem::path& path, const nlohmann::json& item) { std::lock_guard<std::mutex> guard(mutex_); std::ofstream(path, std::ios::app) << item.dump() << '\n'; }
nlohmann::json OfflineGateway::pendingEvents() { std::lock_guard<std::mutex> guard(mutex_); const auto queue=baseDir_/"data"/"offline-events.jsonl";const auto syncing=baseDir_/"data"/"offline-events.syncing";if(!std::filesystem::exists(syncing)&&std::filesystem::exists(queue))MoveFileExW(queue.c_str(),syncing.c_str(),MOVEFILE_REPLACE_EXISTING|MOVEFILE_WRITE_THROUGH);nlohmann::json events=nlohmann::json::array();std::ifstream in(syncing);std::string line;while(std::getline(in,line)){try{events.push_back(nlohmann::json::parse(line));}catch(...){}}return events; }
void OfflineGateway::clearEvents() { std::lock_guard<std::mutex> guard(mutex_); std::error_code error;std::filesystem::remove(baseDir_/"data"/"offline-events.syncing",error); }

nlohmann::json OfflineGateway::identify(const nlohmann::json& body) {
  const std::string image = body.value("imagem", "");
  if (image.empty()) throw std::runtime_error("Captura ausente");
  const auto result = engine_.identify({image, image}, 0.0);
  const std::string subject = result.value("subject", ""); const double similarity = result.value("similaridade", 0.0);
  nlohmann::json rule; double threshold = 0.30; long long generated = 0; int validHours = 72;
  { std::lock_guard<std::mutex> guard(mutex_); threshold = snapshot_.value("similaridadeMinima", 0.30); validHours = snapshot_.value("validoPorHoras", 72); if (snapshot_.contains("geradoEmEpoch")) generated=snapshot_.value("geradoEmEpoch",0LL); for(const auto& item:snapshot_.value("regras",nlohmann::json::array())) if(item.value("subject","")==subject){rule=item;break;} }
  const auto now = static_cast<long long>(std::time(nullptr)); const bool snapshotValid = generated > 0 && now-generated <= static_cast<long long>(validHours)*3600;
  const bool recognized = !subject.empty() && similarity >= threshold && !rule.is_null() && !rule.empty();
  bool authorized = recognized && snapshotValid && rule.value("autorizado", false); bool duplicate = false;
  if(authorized){std::lock_guard<std::mutex> guard(mutex_);const auto last=lastRelease_[subject];if(now-last<15){authorized=false;duplicate=true;}else lastRelease_[subject]=now;}
  const std::string reason = !recognized ? "Rosto não reconhecido" : !snapshotValid ? "Regras offline expiradas. Use acesso manual" : duplicate ? "Acesso já registrado. Aguarde alguns segundos" : authorized ? "Acesso offline autorizado" : rule.value("motivo", "Acesso bloqueado");
  nlohmann::json event={{"id",randomHex(12)},{"criadoEmEpoch",now},{"pessoaId",rule.value("pessoaId","")},{"pessoaNome",rule.value("pessoaNome","")},{"pessoaTipo",rule.value("pessoaTipo","")},{"subject",subject},{"similaridade",similarity},{"reconhecido",recognized},{"autorizado",authorized},{"motivo",reason},{"terminalId",body.value("terminalId","terminal-offline")}};
  appendLine(baseDir_/"data"/"offline-events.jsonl",event);
  if(authorized) appendLine(baseDir_/"data"/"local-release.jsonl",{{"id",event["id"]},{"pessoaId",event["pessoaId"]},{"pessoaNome",event["pessoaNome"]},{"origem","reconhecimento-facial-offline"}});
  return {{"ok",true},{"reconhecido",recognized},{"autorizado",authorized},{"jaRegistrado",duplicate},{"motivo",reason},{"similaridade",similarity},{"pessoa",{{"id",rule.value("pessoaId","")},{"nome",rule.value("pessoaNome","")}}}};
}

void OfflineGateway::serve() {
  WSADATA data{}; if(WSAStartup(MAKEWORD(2,2),&data)!=0)return;
  SOCKET listener=socket(AF_INET,SOCK_STREAM,IPPROTO_TCP); sockaddr_in address{};address.sin_family=AF_INET;address.sin_addr.s_addr=INADDR_ANY;address.sin_port=htons(static_cast<u_short>(port_));
  int reuse=1;setsockopt(listener,SOL_SOCKET,SO_REUSEADDR,reinterpret_cast<const char*>(&reuse),sizeof(reuse));
  if(bind(listener,reinterpret_cast<sockaddr*>(&address),sizeof(address))==SOCKET_ERROR||listen(listener,8)==SOCKET_ERROR){closesocket(listener);WSACleanup();return;}
  while(running_){SOCKET client=accept(listener,nullptr,nullptr);if(client==INVALID_SOCKET)continue;std::string request;char buffer[8192];int read=recv(client,buffer,sizeof(buffer),0);if(read>0)request.assign(buffer,read);const auto split=request.find("\r\n\r\n");const std::string first=request.substr(0,request.find("\r\n"));const auto lengthText=header(request,"Content-Length");size_t length=lengthText.empty()?0:static_cast<size_t>(std::stoul(lengthText));std::string body=split==std::string::npos?"":request.substr(split+4);while(body.size()<length){read=recv(client,buffer,sizeof(buffer),0);if(read<=0)break;body.append(buffer,read);}try{if(first.rfind("OPTIONS ",0)==0)sendJson(client,200,{{"ok",true}});else if(first.rfind("GET /status ",0)==0)sendJson(client,200,{{"ok",true},{"servico","Fusion Access Offline"},{"porta",port_}});else if(first.rfind("POST /pair ",0)==0){if(header(request,"X-Fusion-Pair-Code")!=pairingCode_)sendJson(client,401,{{"ok",false},{"mensagem","Código de pareamento inválido"}});else sendJson(client,200,{{"ok",true},{"token",token_}});}else if(first.rfind("POST /identify ",0)==0){if(header(request,"X-Fusion-Local-Token")!=token_)sendJson(client,401,{{"ok",false},{"mensagem","Terminal não pareado"}});else sendJson(client,200,identify(nlohmann::json::parse(body)));}else sendJson(client,400,{{"ok",false},{"mensagem","Rota local inválida"}});}catch(const std::exception& error){sendJson(client,400,{{"ok",false},{"mensagem",error.what()}});}shutdown(client,SD_BOTH);closesocket(client);}
  closesocket(listener);WSACleanup();
}
