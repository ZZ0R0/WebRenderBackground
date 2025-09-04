// main.cpp

#include <gtk/gtk.h>
#include <webkit2/webkit2.h>
#include <gdk/gdkkeysyms-compat.h>
#include <libsoup/soup.h>
#include <iostream>
#include <string>
#include <cstdlib>
#include <ctime>
#include <filesystem>

// Global variables for the HTTP server
static SoupServer* server = NULL;
static guint16 server_port = 0;

/**
 * Callback function to handle load status changes in WebView
 */
static void on_load_changed(WebKitWebView* web_view, WebKitLoadEvent load_event, gpointer user_data) {
    switch (load_event) {
        case WEBKIT_LOAD_STARTED:
            std::cout << "[WebView] Load Started" << std::endl;
            break;
        case WEBKIT_LOAD_REDIRECTED:
            std::cout << "[WebView] Load Redirected" << std::endl;
            break;
        case WEBKIT_LOAD_COMMITTED:
            std::cout << "[WebView] Load Committed" << std::endl;
            break;
        case WEBKIT_LOAD_FINISHED:
            std::cout << "[WebView] Load Finished" << std::endl;
            break;
        default:
            std::cout << "[WebView] Unknown Load Event" << std::endl;
            break;
    }
}

/**
 * Callback function to handle load failures in WebView
 */
static void on_load_failed(WebKitWebView* web_view, WebKitLoadEvent load_event,
                           const gchar* failing_uri, GError* error, gpointer user_data) {
    std::cerr << "[WebView Error] Failed to load URI: " 
              << (failing_uri ? failing_uri : "Unknown")
              << " | Error: " 
              << (error ? error->message : "Unknown Error") 
              << std::endl;
}

/**
 * Callback function to handle key press events in WebView
 * Opens Web Inspector when Ctrl+Shift+I is pressed
 */
static gboolean on_key_press_event(GtkWidget* widget, GdkEventKey* event, gpointer user_data) {
    if ((event->state & GDK_CONTROL_MASK) && 
        (event->state & GDK_SHIFT_MASK) && 
        event->keyval == GDK_KEY_I) {
        // Open the Web Inspector
        WebKitWebInspector* inspector = webkit_web_view_get_inspector(WEBKIT_WEB_VIEW(widget));
        webkit_web_inspector_show(inspector);
        return TRUE;
    }
    return FALSE;
}

/**
 * Function to start an HTTP server serving the specified directory on a random port between 55000 and 56000
 */
void start_http_server(const char* directory_path) {
    // Seed the random number generator
    srand(static_cast<unsigned int>(time(NULL)));
    
    // Attempt to find an available port between 55000 and 55999
    bool server_started = false;
    for (int attempt = 0; attempt < 1000; attempt++) { // Limit attempts to prevent infinite loop
        server_port = 55000 + (rand() % 1000); // Ports between 55000 and 55999
        
        server = soup_server_new(SOUP_SERVER_SERVER_HEADER, "WebRenderBackgroundServer", NULL);
        if (!server) {
            std::cerr << "[HTTP Server] Failed to create SoupServer." << std::endl;
            exit(EXIT_FAILURE);
        }

        // Add a handler to serve static files
        soup_server_add_handler(server, NULL, 
            [](SoupServer* server, SoupMessage* msg, const char* path,
               GHashTable* query, SoupClientContext* client, gpointer data) {
                const char* document_root = static_cast<const char*>(data);
                std::string requested_path = path;

                // Prevent directory traversal attacks
                if (requested_path.find("..") != std::string::npos) {
                    soup_message_set_status(msg, SOUP_STATUS_FORBIDDEN);
                    soup_message_body_append(msg->response_body, SOUP_MEMORY_COPY, "403 Forbidden", 11);
                    soup_message_body_complete(msg->response_body);
                    return;
                }

                // If path is "/", serve "index.html"
                if (requested_path == "/") {
                    requested_path = "/index.html";
                }

                // Construct the absolute file path
                std::string file_path = std::string(document_root) + requested_path;

                // Check if the file exists
                if (!std::filesystem::exists(file_path)) {
                    soup_message_set_status(msg, SOUP_STATUS_NOT_FOUND);
                    soup_message_body_append(msg->response_body, SOUP_MEMORY_COPY, "404 Not Found", 13);
                    soup_message_body_complete(msg->response_body);
                    return;
                }

                // Open the file and read its contents
                FILE* file = fopen(file_path.c_str(), "rb");
                if (!file) {
                    soup_message_set_status(msg, SOUP_STATUS_INTERNAL_SERVER_ERROR);
                    soup_message_body_append(msg->response_body, SOUP_MEMORY_COPY, "500 Internal Server Error", 25);
                    soup_message_body_complete(msg->response_body);
                    return;
                }

                // Determine the file size
                fseek(file, 0, SEEK_END);
                long file_size = ftell(file);
                fseek(file, 0, SEEK_SET);

                // Allocate buffer and read file
                char* buffer = new char[file_size];
                size_t read_size = fread(buffer, 1, file_size, file);
                fclose(file);

                if (read_size != file_size) {
                    delete[] buffer;
                    soup_message_set_status(msg, SOUP_STATUS_INTERNAL_SERVER_ERROR);
                    soup_message_body_append(msg->response_body, SOUP_MEMORY_COPY, "500 Internal Server Error", 25);
                    soup_message_body_complete(msg->response_body);
                    return;
                }

                // Determine Content-Type based on file extension
                std::string extension = "";
                size_t dot_pos = file_path.find_last_of('.');
                if (dot_pos != std::string::npos) {
                    extension = file_path.substr(dot_pos + 1);
                }

                std::string content_type = "application/octet-stream"; // Default MIME type

                if (extension == "html" || extension == "htm") {
                    content_type = "text/html";
                } else if (extension == "js") {
                    content_type = "application/javascript";
                } else if (extension == "css") {
                    content_type = "text/css";
                } else if (extension == "png") {
                    content_type = "image/png";
                } else if (extension == "jpg" || extension == "jpeg") {
                    content_type = "image/jpeg";
                } else if (extension == "gif") {
                    content_type = "image/gif";
                }
                // Add more MIME types as needed

                // Set response headers
                soup_message_headers_append(msg->response_headers, "Content-Type", content_type.c_str());
                soup_message_headers_append(msg->response_headers, "Content-Length", std::to_string(file_size).c_str());

                // Append file data to response body
                soup_message_body_append(msg->response_body, SOUP_MEMORY_TAKE, buffer, file_size);
                soup_message_set_status(msg, SOUP_STATUS_OK);
                soup_message_body_complete(msg->response_body);
            }, 
            (gpointer)directory_path, NULL);

        // Attempt to listen on the selected port
        GError* error = NULL;
        if (soup_server_listen_all(server, server_port, (SoupServerListenOptions)0, &error)) {
            std::cout << "[HTTP Server] Serving '" << directory_path << "' on port: " << server_port << std::endl;
            server_started = true;
            break;
        } else {
            std::cerr << "[HTTP Server] Port " << server_port << " is unavailable. Trying another port." << std::endl;
            g_error_free(error);
            g_object_unref(server);
            server = NULL;
            continue;
        }
    }

    if (!server_started) {
        std::cerr << "[HTTP Server] Failed to start server on any port between 55000 and 55999." << std::endl;
        exit(EXIT_FAILURE);
    }
}

/**
 * Function to set up and display the WebKitWebView
 */
void set_background_webview(const char* url) {
    std::cout << "[Application] Initializing WebView with URL: " << url << std::endl;

    GtkWidget* window = gtk_window_new(GTK_WINDOW_TOPLEVEL);
    g_signal_connect(window, "destroy", G_CALLBACK(gtk_main_quit), NULL);
    gtk_window_set_title(GTK_WINDOW(window), "WebRenderBackground");
    gtk_window_set_default_size(GTK_WINDOW(window), 800, 600);
    gtk_window_set_decorated(GTK_WINDOW(window), FALSE);
    gtk_window_fullscreen(GTK_WINDOW(window));

    // Set the window type hint to desktop
    gtk_window_set_type_hint(GTK_WINDOW(window), GDK_WINDOW_TYPE_HINT_DESKTOP);

    // Create a new WebView
    GtkWidget* webview = webkit_web_view_new();
    std::cout << "[WebView] Creating new WebKitWebView instance." << std::endl;

    // Get the WebKitSettings from the WebView
    WebKitSettings* settings = webkit_web_view_get_settings(WEBKIT_WEB_VIEW(webview));

    // Enable JavaScript
    webkit_settings_set_enable_javascript(settings, TRUE);

    // Enable Developer Extras for Web Inspector
    webkit_settings_set_enable_developer_extras(settings, TRUE);

    // Enable hardware acceleration features
    webkit_settings_set_enable_webgl(settings, TRUE);
    webkit_settings_set_enable_media_stream(settings, TRUE);
    webkit_settings_set_enable_webrtc(settings, TRUE);

    // Connect key press event to handle Web Inspector toggle
    g_signal_connect(webview, "key-press-event", G_CALLBACK(on_key_press_event), NULL);

    // Connect load signals
    g_signal_connect(webview, "load-changed", G_CALLBACK(on_load_changed), NULL);
    g_signal_connect(webview, "load-failed", G_CALLBACK(on_load_failed), NULL);

    // Load the website from the local server
    std::cout << "[WebView] Loading URI: " << url << std::endl;
    webkit_web_view_load_uri(WEBKIT_WEB_VIEW(webview), url);

    gtk_container_add(GTK_CONTAINER(window), webview);
    gtk_widget_show_all(window);

    std::cout << "[Application] WebView setup complete and window displayed." << std::endl;
}

/**
 * Main function
 */
int main(int argc, char* argv[]) {
    gtk_init(&argc, &argv);

    if (argc != 2) {
        std::cerr << "Usage: " << argv[0] << " <AbsolutePathToWebsiteDirectory>" << std::endl;
        return EXIT_FAILURE;
    }

    const char* website_directory = argv[1];

    // Validate the website directory
    if (!std::filesystem::is_directory(website_directory)) {
        std::cerr << "[Application] Error: '" << website_directory << "' is not a valid directory." << std::endl;
        return EXIT_FAILURE;
    }

    std::cout << "[Application] Starting application." << std::endl;
    std::cout << "[Application] Website directory: " << website_directory << std::endl;

    // Start the HTTP server
    start_http_server(website_directory);

    // Construct the local server URL
    std::string local_url = "http://localhost:" + std::to_string(server_port) + "/";

    // Set up the WebView to load the local server URL
    set_background_webview(local_url.c_str());

    std::cout << "[Application] Entering GTK main loop." << std::endl;
    gtk_main();

    // Clean up the HTTP server when exiting
    if (server) {
        soup_server_disconnect(server);
        g_object_unref(server);
        std::cout << "[HTTP Server] Server shut down gracefully." << std::endl;
    }

    std::cout << "[Application] Exiting." << std::endl;
    return EXIT_SUCCESS;
}