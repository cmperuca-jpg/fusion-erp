cmake_minimum_required(VERSION 3.24)
project(FusionFacialWorker VERSION 1.0.1 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")

find_package(OpenCV REQUIRED COMPONENTS core imgcodecs imgproc objdetect dnn)
find_package(nlohmann_json CONFIG REQUIRED)

add_executable(FusionFacialWorker
  src/main.cpp
  src/http_client.cpp
  src/face_engine.cpp
  src/offline_gateway.cpp
)
target_include_directories(FusionFacialWorker PRIVATE src)
target_link_libraries(FusionFacialWorker PRIVATE ${OpenCV_LIBS} nlohmann_json::nlohmann_json winhttp crypt32 bcrypt ws2_32)
target_compile_definitions(FusionFacialWorker PRIVATE UNICODE _UNICODE NOMINMAX WIN32_LEAN_AND_MEAN)
if(MSVC)
  target_compile_options(FusionFacialWorker PRIVATE /W4 /permissive- /utf-8)
endif()

install(TARGETS FusionFacialWorker RUNTIME DESTINATION .)
