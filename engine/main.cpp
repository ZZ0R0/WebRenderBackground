#include <QApplication>
#include <QDesktopWidget>
#include <QWebEngineView>
#include <QWebEngineSettings>
#include <QUrl>
#include <QFileInfo>
#include <QDir>


class MyApplication : public QApplication {
public:
    MyApplication(int &argc, char **argv) : QApplication(argc, argv) {}

    bool notify(QObject *receiver, QEvent *event) override {
        if (event->type() == QEvent::MouseButtonPress) {
            return true;
        }
        return QApplication::notify(receiver, event);
    }
};

int main(int argc, char *argv[]) {
    MyApplication app(argc, argv);

    QWebEngineView *view1 = new QWebEngineView();
    QWebEngineSettings *settings1 = view1->settings();
    settings1->setAttribute(QWebEngineSettings::JavascriptEnabled, true);
    view1->setWindowFlags(Qt::WindowStaysOnBottomHint | Qt::FramelessWindowHint | Qt::WindowCloseButtonHint);

    QWebEngineView *view2 = new QWebEngineView();
    QWebEngineSettings *settings2 = view2->settings();
    settings2->setAttribute(QWebEngineSettings::JavascriptEnabled, true);
    view2->setWindowFlags(Qt::WindowStaysOnBottomHint | Qt::FramelessWindowHint);

    QString exePath = QCoreApplication::applicationDirPath();
    QDir::setCurrent(exePath);

    QFileInfo fileInfo("../website/index.html");
    QString indexPath = fileInfo.absoluteFilePath();

    QRect screenres1 = QApplication::desktop()->screenGeometry(0);
    view1->move(QPoint(screenres1.x(), screenres1.y()));
    view1->resize(screenres1.width(), screenres1.height());
    view1->load(QUrl::fromLocalFile(indexPath));
    view1->showFullScreen();

    QRect screenres2 = QApplication::desktop()->screenGeometry(1);
    view2->move(QPoint(screenres2.x(), screenres2.y()));
    view2->resize(screenres2.width(), screenres2.height());
    view2->load(QUrl::fromLocalFile(indexPath));
    view2->showFullScreen();

    return app.exec();
}
