#pragma once
#include <filesystem>
#include <mutex>
#include <string>
#include <vector>
#include <nlohmann/json.hpp>
#include <opencv2/core.hpp>
#include <opencv2/objdetect.hpp>

struct FaceSample {
  cv::Mat feature;
  double yaw = 0;
};

class FaceEngine {
public:
  explicit FaceEngine(const std::filesystem::path& baseDir);
  nlohmann::json enroll(const std::string& subject, const std::vector<std::string>& images);
  nlohmann::json identify(const std::vector<std::string>& images, double movementMinimum);
  nlohmann::json remove(const std::string& subject);
  std::string status() const;
private:
  FaceSample extract(const std::string& base64Image);
  void loadGallery();
  void saveGallery();
  static std::vector<unsigned char> decodeBase64(std::string value);

  std::filesystem::path baseDir_;
  std::filesystem::path galleryPath_;
  cv::Ptr<cv::FaceDetectorYN> detector_;
  cv::Ptr<cv::FaceRecognizerSF> recognizer_;
  nlohmann::json gallery_ = nlohmann::json::object();
  mutable std::mutex mutex_;
};
