#pragma once
#include <map>
#include <string>

struct HttpResponse {
  int status = 0;
  std::string body;
};

class HttpClient {
public:
  explicit HttpClient(std::string baseUrl);
  HttpResponse request(const std::string& method, const std::string& path,
                       const std::string& body,
                       const std::map<std::string, std::string>& headers) const;
private:
  std::string baseUrl_;
};
