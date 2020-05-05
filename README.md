
# Intro

This will deploy a Ruby on Rails 6 chat app with Redis and Postgres backend on AWS Fargate.

```
# install docker-compose -> [Install Docker Compose | Docker Documentation](https://docs.docker.com/compose/install/)


cd RoRChat-cdk/
git clone https://github.com/enghwa/RoRChat RoRChat

cd RoRChat

# build local Docker container for RoR6 chat app

docker build -t ror6dev --build-arg USER_ID=$(id -u) --build-arg GROUP_ID=$(id -g) .


# bring up the app with mysql and redis

docker-compose run  --user "$(id -u):$(id -g)" -p8080:8010  ror6 bundle exec rake db:setup 

docker-compose run  --user "$(id -u):$(id -g)" -p8080:8010  ror6

```

# deploy to AWS, using ECS Fargate

```

# lets build our vpc
cdk list
cdk synth 
cdk deploy ror6Vpc

# lets build our db/redis
cdk list
cdk deploy postgresDBRedis

# lets build alb/fargate/ROR6 chat

cdk deploy RoRFargate
```