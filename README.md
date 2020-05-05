

```
# install docker-compose -> [Install Docker Compose | Docker Documentation](https://docs.docker.com/compose/install/)


# build local Docker container for RoR6 chat app

docker build -t ror6dev --build-arg USER_ID=$(id -u) --build-arg GROUP_ID=$(id -g) .


# bring up the app with mysql and redis

docker-compose run  --user "$(id -u):$(id -g)" -p8080:8010  ror6 bundle exec rake db:setup 

docker-compose run  --user "$(id -u):$(id -g)" -p8080:8010  ror6

```

```
mkdir RoRChat-cdk/
cd RoRChat-cdk/


cdk init --language typescript

npm i @aws-cdk/aws-codebuild @aws-cdk/aws-codepipeline @aws-cdk/aws-codepipeline-actions @aws-cdk/aws-ecr @aws-cdk/aws-ecs-patterns @aws-cdk/aws-elasticache @aws-cdk/aws-iam @aws-cdk/aws-rds @aws-cdk/aws-route53 @aws-cdk/aws-servicediscovery  --save

#rename
cd lib
mv ro_r_chat-cdk-stack.ts vpc-stack.ts
cd ..

#fix test
npm run build

# lets build our vpc
cdk synth
cdk deploy

# lets build our db/redis
cdk list
cdk deploy postgresDBRedis

# lets build alb/fargate/ROR6 chat

cdk deploy RoRFargate
```