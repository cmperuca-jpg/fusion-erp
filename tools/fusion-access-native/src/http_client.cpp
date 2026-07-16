#include "http_client.h"
#include <windows.h>
#include <winhttp.h>
#include <stdexcept>
#include <vector>

namespace {
std::wstring wide(const std::string& value) {
  if (value.empty()) return {};
  const int size = MultiByteToWideChar(CP_UTF8, 0, value.data(), static_cast<int>(value.size()), nullptr, 0);
  std::wstring out(size, L'\0');
  MultiByteToWideChar(CP_UTF8, 0, value.data(), static_cast<int>(value.size()), out.data(), size);
  return out;
}

struct Handle {
  HINTERNET value = nullptr;
  ~Handle() { if (value) WinHttpCloseHandle(value); }
  operator HINTERNET() const { return value; }
};
}

HttpClient::HttpClient(std::string baseUrl) : baseUrl_(std::move(baseUrl)) {
  while (!baseUrl_.empty() && baseUrl_.back() == '/') baseUrl_.pop_back();
}

HttpResponse HttpClient::request(const std::string& method, const std::string& path,
                                 const std::string& body,
                                 const std::map<std::string, std::string>& headers) const {
  const std::wstring full = wide(baseUrl_ + path);
  URL_COMPONENTS parts{}; parts.dwStructSize = sizeof(parts);
  parts.dwSchemeLength = static_cast<DWORD>(-1); parts.dwHostNameLength = static_cast<DWORD>(-1);
  parts.dwUrlPathLength = static_cast<DWORD>(-1); parts.dwExtraInfoLength = static_cast<DWORD>(-1);
  if (!WinHttpCrackUrl(full.c_str(), 0, 0, &parts)) throw std::runtime_error("URL do Fusion inválida");

  const std::wstring host(parts.lpszHostName, parts.dwHostNameLength);
  std::wstring route(parts.lpszUrlPath, parts.dwUrlPathLength);
  if (parts.dwExtraInfoLength) route.append(parts.lpszExtraInfo, parts.dwExtraInfoLength);

  Handle session{WinHttpOpen(L"FusionAccessNative/1.0", WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY,
                             WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0)};
  if (!session.value) throw std::runtime_error("Falha ao iniciar conexão HTTPS");
  WinHttpSetTimeouts(session, 10000, 10000, 20000, 30000);
  Handle connection{WinHttpConnect(session, host.c_str(), parts.nPort, 0)};
  if (!connection.value) throw std::runtime_error("Falha ao conectar ao Fusion");

  const DWORD flags = parts.nScheme == INTERNET_SCHEME_HTTPS ? WINHTTP_FLAG_SECURE : 0;
  const std::wstring verb = wide(method);
  Handle request{WinHttpOpenRequest(connection, verb.c_str(), route.c_str(), nullptr,
                                    WINHTTP_NO_REFERER, WINHTTP_DEFAULT_ACCEPT_TYPES, flags)};
  if (!request.value) throw std::runtime_error("Falha ao preparar requisição");

  std::wstring allHeaders;
  for (const auto& [key, value] : headers) allHeaders += wide(key + ": " + value + "\r\n");
  if (!body.empty()) allHeaders += L"Content-Type: application/json\r\n";
  const BOOL sent = WinHttpSendRequest(request, allHeaders.c_str(), static_cast<DWORD>(-1L),
      body.empty() ? WINHTTP_NO_REQUEST_DATA : const_cast<char*>(body.data()),
      static_cast<DWORD>(body.size()), static_cast<DWORD>(body.size()), 0);
  if (!sent || !WinHttpReceiveResponse(request, nullptr)) throw std::runtime_error("Servidor Fusion indisponível");

  DWORD status = 0, statusSize = sizeof(status);
  WinHttpQueryHeaders(request, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
                      WINHTTP_HEADER_NAME_BY_INDEX, &status, &statusSize, WINHTTP_NO_HEADER_INDEX);
  std::string responseBody;
  for (;;) {
    DWORD available = 0;
    if (!WinHttpQueryDataAvailable(request, &available) || available == 0) break;
    std::vector<char> buffer(available);
    DWORD read = 0;
    if (!WinHttpReadData(request, buffer.data(), available, &read)) break;
    responseBody.append(buffer.data(), read);
  }
  return {static_cast<int>(status), std::move(responseBody)};
}
