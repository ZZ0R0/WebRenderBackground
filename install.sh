sudo apt-get install -y qt5-qmake qtwebengine5-dev
cd ./engine
qmake
make
cd engine
echo -e "\nRun ./project to start the project\n"
ls