#include "face_engine.h"
#include <windows.h>
#include <wincrypt.h>
#include <algorithm>
#include <cmath>
#include <ctime>
#include <fstream>
#include <stdexcept>
#include <opencv2/imgcodecs.hpp>
#include <opencv2/imgproc.hpp>

namespace {
std::vector<unsigned char> protect(const std::string& plain) {
  DATA_BLOB input{static_cast<DWORD>(plain.size()), reinterpret_cast<BYTE*>(const_cast<char*>(plain.data()))};
  DATA_BLOB output{};
  if (!CryptProtectData(&input, L"Fusion ERP - Biometria facial", nullptr, nullptr, nullptr,
                        CRYPTPROTECT_LOCAL_MACHINE | CRYPTPROTECT_UI_FORBIDDEN, &output)) {
    throw std::runtime_error("Não foi possível proteger a galeria biométrica");
  }
  std::vector<unsigned char> result(output.pbData, output.pbData + output.cbData);
  LocalFree(output.pbData);
  return result;
}

std::string unprotect(const std::vector<unsigned char>& encrypted) {
  if (encrypted.empty()) return "{}";
  DATA_BLOB input{static_cast<DWORD>(encrypted.size()), const_cast<BYTE*>(encrypted.data())};
  DATA_BLOB output{};
  if (!CryptUnprotectData(&input, nullptr, nullptr, nullptr, nullptr,
                          CRYPTPROTECT_UI_FORBIDDEN, &output)) {
    throw std::runtime_error("A galeria biométrica não pôde ser aberta neste computador");
  }
  std::string result(reinterpret_cast<char*>(output.pbData), output.cbData);
  LocalFree(output.pbData);
  return result;
}

std::vector<float> matToVector(const cv::Mat& mat) {
  cv::Mat continuous = mat.isContinuous() ? mat : mat.clone();
  return {continuous.ptr<float>(), continuous.ptr<float>() + continuous.total()};
}
}

FaceEngine::FaceEngine(const std::filesystem::path& baseDir)
    : baseDir_(baseDir), galleryPath_(baseDir / "data" / "faces.dat") {
  const auto detectorModel = (baseDir / "models" / "face_detection_yunet_2023mar.onnx").string();
  const auto recognizerModel = (baseDir / "models" / "face_recognition_sface_2021dec.onnx").string();
  if (!std::filesystem::exists(detectorModel) || !std::filesystem::exists(recognizerModel)) {
    throw std::runtime_error("Modelos faciais não encontrados. Repare a instalação do Fusion Access.");
  }
  // Mantém precisão, mas aceita câmeras comuns e iluminação real de academia.
  detector_ = cv::FaceDetectorYN::create(detectorModel, "", cv::Size(320, 320), 0.75f, 0.3f, 5000);
  recognizer_ = cv::FaceRecognizerSF::create(recognizerModel, "");
  std::filesystem::create_directories(galleryPath_.parent_path());
  loadGallery();
}

std::vector<unsigned char> FaceEngine::decodeBase64(std::string value) {
  const auto comma = value.find(',');
  if (comma != std::string::npos && value.substr(0, comma).find("base64") != std::string::npos) value.erase(0, comma + 1);
  DWORD size = 0;
  if (!CryptStringToBinaryA(value.c_str(), static_cast<DWORD>(value.size()), CRYPT_STRING_BASE64,
                            nullptr, &size, nullptr, nullptr)) throw std::runtime_error("Imagem facial inválida");
  std::vector<unsigned char> bytes(size);
  if (!CryptStringToBinaryA(value.c_str(), static_cast<DWORD>(value.size()), CRYPT_STRING_BASE64,
                            bytes.data(), &size, nullptr, nullptr)) throw std::runtime_error("Imagem facial inválida");
  bytes.resize(size);
  return bytes;
}

FaceSample FaceEngine::extract(const std::string& base64Image) {
  const auto bytes = decodeBase64(base64Image);
  cv::Mat image = cv::imdecode(bytes, cv::IMREAD_COLOR);
  if (image.empty()) throw std::runtime_error("Não foi possível abrir a captura da câmera");
  if (image.cols < 240 || image.rows < 240) throw std::runtime_error("Aproxime o rosto da câmera");

  detector_->setInputSize(image.size());
  cv::Mat faces;
  detector_->detect(image, faces);
  if (faces.rows != 1) {
    if (faces.rows < 1) throw std::runtime_error("Nenhum rosto foi encontrado");
    throw std::runtime_error("Mantenha somente uma pessoa diante da câmera");
  }
  const float width = faces.at<float>(0, 2);
  const float height = faces.at<float>(0, 3);
  if (width * height < image.cols * image.rows * 0.055f) throw std::runtime_error("Aproxime o rosto da câmera");

  const cv::Mat face = faces.row(0).clone();
  cv::Mat aligned, feature;
  recognizer_->alignCrop(image, face, aligned);
  recognizer_->feature(aligned, feature);
  cv::normalize(feature, feature);

  const double center = face.at<float>(0, 0) + width / 2.0;
  const double nose = face.at<float>(0, 8);
  const double yaw = width > 1 ? (nose - center) / width : 0.0;
  return {feature.clone(), yaw};
}

void FaceEngine::loadGallery() {
  std::lock_guard<std::mutex> guard(mutex_);
  if (!std::filesystem::exists(galleryPath_)) { gallery_ = nlohmann::json::object(); return; }
  std::ifstream input(galleryPath_, std::ios::binary);
  std::vector<unsigned char> encrypted((std::istreambuf_iterator<char>(input)), std::istreambuf_iterator<char>());
  gallery_ = nlohmann::json::parse(unprotect(encrypted), nullptr, true);
  if (!gallery_.is_object()) gallery_ = nlohmann::json::object();
}

void FaceEngine::saveGallery() {
  const auto encrypted = protect(gallery_.dump());
  const auto temporary = galleryPath_.string() + ".tmp";
  {
    std::ofstream output(temporary, std::ios::binary | std::ios::trunc);
    output.write(reinterpret_cast<const char*>(encrypted.data()), static_cast<std::streamsize>(encrypted.size()));
    output.flush();
    if (!output) throw std::runtime_error("Não foi possível salvar a galeria biométrica");
  }
  if (!MoveFileExW(std::filesystem::path(temporary).c_str(), galleryPath_.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) {
    throw std::runtime_error("Não foi possível concluir a gravação da galeria biométrica");
  }
}

nlohmann::json FaceEngine::enroll(const std::string& subject, const std::vector<std::string>& images) {
  if (subject.empty() || images.size() < 3) throw std::runtime_error("Cadastro facial incompleto");
  std::vector<FaceSample> samples;
  for (const auto& image : images) samples.push_back(extract(image));
  cv::Mat average = cv::Mat::zeros(samples[0].feature.size(), samples[0].feature.type());
  for (const auto& sample : samples) average += sample.feature;
  average /= static_cast<double>(samples.size());
  cv::normalize(average, average);

  std::lock_guard<std::mutex> guard(mutex_);
  gallery_[subject] = { {"feature", matToVector(average)}, {"updatedAt", std::time(nullptr)} };
  saveGallery();
  return {{"exemplos", nlohmann::json::array({"frente", "esquerda", "direita"})}};
}

nlohmann::json FaceEngine::identify(const std::vector<std::string>& images, double movementMinimum) {
  if (images.size() < 2) throw std::runtime_error("Prova de movimento incompleta");
  const FaceSample first = extract(images[0]);
  const FaceSample second = extract(images[1]);
  const bool movementValid = std::abs(second.yaw - first.yaw) * 100.0 >= movementMinimum;

  std::string bestSubject;
  double best = -1.0;
  std::lock_guard<std::mutex> guard(mutex_);
  for (auto it = gallery_.begin(); it != gallery_.end(); ++it) {
    const auto values = it.value().value("feature", std::vector<float>{});
    if (values.empty()) continue;
    cv::Mat stored(1, static_cast<int>(values.size()), CV_32F, const_cast<float*>(values.data()));
    const double score = recognizer_->match(stored, second.feature, cv::FaceRecognizerSF::DisType::FR_COSINE);
    if (score > best) { best = score; bestSubject = it.key(); }
  }
  return {{"subject", bestSubject}, {"similaridade", std::max(0.0, best)}, {"movimentoValido", movementValid}};
}

nlohmann::json FaceEngine::remove(const std::string& subject) {
  std::lock_guard<std::mutex> guard(mutex_);
  const auto removed = gallery_.erase(subject);
  saveGallery();
  return {{"removido", removed > 0}};
}

std::string FaceEngine::status() const {
  std::lock_guard<std::mutex> guard(mutex_);
  return "nativo-online:" + std::to_string(gallery_.size()) + "-cadastros";
}
