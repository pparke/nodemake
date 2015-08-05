CC = g++
CFLAGS = -g -Wall -std=c++11
# Filename
NAME = helloworld
# Remove on clean
TODELETE = $(NAME) *.o


all : main.cpp Hello.o
	$(CC) $(CFLAGS) main.cpp Hello.cpp -o $(NAME)

Hello.o : Hello.cpp Hello.h
	$(CC) $(CFLAGS) Hello.cpp -c

random.o : nothing
	$(CC) $(CFLAGS) nothing

clean:
	rm -f $(TODELETE)
