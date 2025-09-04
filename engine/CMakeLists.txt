# CMakeLists.txt

cmake_minimum_required(VERSION 3.10)
project(WebRenderBackground)

# Set the C++ standard to C++17
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find PkgConfig
find_package(PkgConfig REQUIRED)

# Find GTK3
pkg_check_modules(GTK3 REQUIRED gtk+-3.0)

# Find WebKit2GTK
pkg_check_modules(WEBKIT2GTK REQUIRED webkit2gtk-4.0)

# Find libsoup
pkg_check_modules(LIBSOUP REQUIRED libsoup-2.4)

# Verify that all required packages are found
if(NOT GTK3_FOUND)
    message(FATAL_ERROR "GTK3 not found")
endif()

if(NOT WEBKIT2GTK_FOUND)
    message(FATAL_ERROR "WebKit2GTK not found")
endif()

if(NOT LIBSOUP_FOUND)
    message(FATAL_ERROR "libsoup not found")
endif()

# ----------------------------
# Define the main executable
# ----------------------------
add_executable(WebRenderBackground src/main.cpp)

# Include directories for GTK3, WebKit2GTK, and libsoup
target_include_directories(WebRenderBackground PRIVATE
    ${GTK3_INCLUDE_DIRS}
    ${WEBKIT2GTK_INCLUDE_DIRS}
    ${LIBSOUP_INCLUDE_DIRS}
)

# Apply any necessary compiler flags
target_compile_options(WebRenderBackground PRIVATE
    ${GTK3_CFLAGS_OTHER}
    ${WEBKIT2GTK_CFLAGS_OTHER}
    ${LIBSOUP_CFLAGS_OTHER}
)

# Link the GTK3, WebKit2GTK, and libsoup libraries to the executable
target_link_libraries(WebRenderBackground PRIVATE
    ${GTK3_LIBRARIES}
    ${WEBKIT2GTK_LIBRARIES}
    ${LIBSOUP_LIBRARIES}
)

# ----------------------------
# Define the WebKit Web Extension
# ----------------------------
add_library(WebKitWebExtension MODULE src/web_extension.cpp)

# Include directories for the WebKit Web Extension
target_include_directories(WebKitWebExtension PRIVATE
    ${GTK3_INCLUDE_DIRS}
    ${WEBKIT2GTK_INCLUDE_DIRS}
    ${LIBSOUP_INCLUDE_DIRS}
)

# Apply any necessary compiler flags to the WebKit Web Extension
target_compile_options(WebKitWebExtension PRIVATE
    ${GTK3_CFLAGS_OTHER}
    ${WEBKIT2GTK_CFLAGS_OTHER}
    ${LIBSOUP_CFLAGS_OTHER}
)

# Link the GTK3, WebKit2GTK, and libsoup libraries to the WebKit Web Extension
target_link_libraries(WebKitWebExtension PRIVATE
    ${GTK3_LIBRARIES}
    ${WEBKIT2GTK_LIBRARIES}
    ${LIBSOUP_LIBRARIES}
)

# Specify the output directory for the WebKit Web Extension
set_target_properties(WebKitWebExtension PROPERTIES
    LIBRARY_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/extensions"
)