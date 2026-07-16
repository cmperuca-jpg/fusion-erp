#include "face_engine.h"
#include "http_client.h"
#include <windows.h>
#include <chrono>
#include <algorithm>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <map>
#include <thread>
#include <nlohmann/json.hpp>

namespace {
std::map<std::string, std::string> readEnv(const std::filesystem::path& path) {
  std::ifstream input(path);
  if (!input) throw std::runtime_error("Configuração do agente não encontrada");
  std::map<std::string, std::string> result;
  std::string line;
  while (std::getline(input, line)) {
    if (!line.empty() && line.back() == '\r') line.pop_back();
    if (line.size() >= 3 && static_cast<unsigned char>(line[0]) == 0xEF && static_cast<unsigned char>(line[1]) == 0xBB && static_cast<unsigned char>(line[2]) == 0xBF) line.erase(0, 3);
    if (line.empty() || line[0] == '#') continue;
    const auto pos = line.find('=');
    if (pos != std::string::npos) result[line.substr(0, pos)] = line.substr(pos + 1);
  }
  return result;
}

std::filesystem::path executableDir() {
  std::wstring buffer(32768, L'\0');
  const DWORD size = GetModuleFileNameW(nullptr, buffer.data(), static_cast<DWORD>(buffer.size()));
  buffer.resize(size);
  return std::filesystem::path(buffer).parent_path();
}

void log(const std::filesystem::path& base, const std::string& level, const std::string& message) {
  std::filesystem::create_directories(base / "logs");
  const auto logPath = base / "logs" / "facial.log";
  std::error_code sizeError;
  if (std::filesystem::exists(logPath) && std::filesystem::file_size(logPath, sizeError) > 5 * 1024 * 1024) {
    MoveFileExW(logPath.c_str(), (base / "logs" / "facial.log.1").c_str(), MOVEFILE_REPLACE_EXISTING);
  }
  SYSTEMTIME time{}; GetLocalTime(&time);
  char stamp[32];
  std::snprintf(stamp, sizeof(stamp), "%04u-%02u-%02u %02u:%02u:%02u",
                time.wYear, time.wMonth, time.wDay, time.wHour, time.wMinute, time.wSecond);
  std::ofstream out(logPath, std::ios::app);
  out << stamp << " [" << level << "] " << message << '\n';
}

std::vector<std::string> imagesFrom(const nlohmann::json& payload) {
  std::vector<std::string> images;
  if (payload.contains("imagens") && payload["imagens"].is_array()) {
    for (const auto& item : payload["imagens"]) if (item.is_string()) images.push_back(item.get<std::string>());
  }
  return images;
}
}

int main(int argc, char** argv) {
  SetConsoleOutputCP(CP_UTF8);
  HANDLE singleton = CreateMutexW(nullptr, TRUE, L"Global\\FusionFacialWorker");
  if (!singleton || GetLastError() == ERROR_ALREADY_EXISTS) return 0;
  const auto base = executableDir();
  try {
    if (argc > 1 && std::string(argv[1]) == "--self-test") {
      FaceEngine engine(base);
      log(base, "INFO", "Autoteste do motor facial concluído");
      if (singleton) CloseHandle(singleton);
      return 0;
    }
    const auto config = readEnv(base / "agent.env");
    const auto server = config.at("ACCESS_SERVER_URL");
    const auto agentId = config.at("ACCESS_AGENT_ID");
    const auto token = config.at("ACCESS_AGENT_TOKEN");
    const int pollMs = std::max(1000, std::stoi(config.count("ACCESS_AGENT_POLL_MS") ? config.at("ACCESS_AGENT_POLL_MS") : "1500"));
    HttpClient http(server);
    FaceEngine engine(base);
    log(base, "INFO", "Motor facial nativo iniciado");

    const std::map<std::string, std::string> auth = {
      {"x-agent-id", agentId}, {"x-agent-token", token},
      {"x-facial-agent-version", "native-1.0.0"}, {"x-facial-engine-status", engine.status()}
    };
    while (true) {
      try {
        const auto response = http.request("GET", "/api/reconhecimento-facial/agent/next", "", auth);
        if (response.status < 200 || response.status >= 300) throw std::runtime_error("Servidor respondeu HTTP " + std::to_string(response.status));
        const auto data = nlohmann::json::parse(response.body);
        if (!data.contains("tarefa") || data["tarefa"].is_null()) {
          std::this_thread::sleep_for(std::chrono::milliseconds(pollMs));
          continue;
        }
        const auto task = data["tarefa"];
        const std::string id = task.value("id", "");
        const std::string action = task.value("acao", "");
        const auto payload = task.value("payload", nlohmann::json::object());
        nlohmann::json result;
        try {
          if (action == "cadastrar") result = engine.enroll(payload.value("subject", ""), imagesFrom(payload));
          else if (action == "identificar") result = engine.identify(imagesFrom(payload), payload.value("movimentoMinimo", 8.0));
          else if (action == "remover") result = engine.remove(payload.value("subject", ""));
          else throw std::runtime_error("Operação facial não suportada");

          const nlohmann::json body = {{"ok", true}, {"resultado", result}};
          const auto completed = http.request("POST", "/api/reconhecimento-facial/agent/tasks/" + id + "/result", body.dump(), auth);
          if (completed.status < 200 || completed.status >= 300) throw std::runtime_error("Falha ao confirmar tarefa facial");
          log(base, "INFO", "Tarefa facial concluída: " + action);
        } catch (const std::exception& error) {
          const nlohmann::json body = {{"ok", false}, {"erro", error.what()}};
          http.request("POST", "/api/reconhecimento-facial/agent/tasks/" + id + "/result", body.dump(), auth);
          log(base, "ERROR", std::string("Tarefa facial falhou: ") + error.what());
        }
      } catch (const std::exception& error) {
        log(base, "ERROR", std::string("Conexão facial: ") + error.what());
        std::this_thread::sleep_for(std::chrono::seconds(5));
      }
    }
  } catch (const std::exception& error) {
    log(base, "FATAL", error.what());
    if (singleton) CloseHandle(singleton);
    return 1;
  }
}
