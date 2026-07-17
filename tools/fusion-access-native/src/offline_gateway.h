#pragma once
#include "face_engine.h"
#include <atomic>
#include <filesystem>
#include <mutex>
#include <map>
#include <string>
#include <thread>
#include <nlohmann/json.hpp>

class OfflineGateway {
public:
  OfflineGateway(FaceEngine& engine, std::filesystem::path baseDir, int port = 8765);
  ~OfflineGateway();
  void start();
  void stop();
  void updateRules(const nlohmann::json& snapshot);
  nlohmann::json pendingEvents();
  void clearEvents();
  std::string pairingCode() const;
private:
  void serve();
  nlohmann::json identify(const nlohmann::json& body);
  void appendLine(const std::filesystem::path& path, const nlohmann::json& item);
  void loadState();
  FaceEngine& engine_;
  std::filesystem::path baseDir_;
  int port_;
  std::atomic<bool> running_{false};
  std::thread thread_;
  mutable std::mutex mutex_;
  nlohmann::json snapshot_ = nlohmann::json::object();
  std::map<std::string, long long> lastRelease_;
  std::string token_;
  std::string pairingCode_;
};
