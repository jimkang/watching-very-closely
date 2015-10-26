pushall: build-docker-image push-docker-image
	git push origin master

create-docker-machine:
	docker-machine create --driver virtualbox dev

stop-docker-machine:
	docker-machine stop dev

start-docker-machine:
	docker-machine start dev

connect-to-docker-machine:
	eval "$(docker-machine env dev)"

build-docker-image:
	docker build -t jkang/watching-very-closely .

push-docker-image:
	docker push jkang/watching-very-closely

run-docker-image:
	docker run -v $(HOMEDIR)/config:/usr/src/app/config \
		jkang/watching-very-closely make run

run:
	node post-watching-tweet.js
