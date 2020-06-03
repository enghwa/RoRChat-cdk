- [RoR Chat on  Amazon EC2 Container Service (ECS)](#ror-chat-on--amazon-ec2-container-service--ecs-)
  * [Amazon ECS](#amazon-ecs)
  * [ECS Basic Concepts](#ecs-basic-concepts)
  * [Pre-requisites](#pre-requisites)
    + [Setup Cloud9](#setup-cloud9)
    + [Resize EBS storage](#resize-ebs-storage)
    + [Install Docker composer](#install-docker-composer)
  * [Chat application on Docker (Local)](#chat-application-on-docker--local-)
  * [Chat application on ECS](#chat-application-on-ecs)
  * [Custom domain name for Load balancer with SSL](#custom-domain-name-alb)
  * [CI/CD](#ci-cd)  

# RoR Chat on  Amazon EC2 Container Service (ECS)

This will deploy a Ruby on Rails 6 chat app with Redis and Postgres backend on ECS using CDK.

## <a name="amazon-ecs"></a>Amazon ECS
Amazon Elastic Container Service (Amazon ECS) is a **fully managed container orchestration** service. ECS has been a foundational pillar for key Amazon services, it can **natively integrate** with other services such as Amazon Route 53, Secrets Manager, AWS Identity and Access Management (IAM), and Amazon CloudWatch providing you a familiar experience to deploy and scale your containers. ECS allows your applications the flexibility to use a mix of **Amazon EC2** and **AWS Fargate** with Spot and On-Demand pricing options. 

## <a name="ecs-basic-concepts"></a>ECS Basic Concepts

Container Instance:: An AMI instance that is primed for running containers. By default, each Amazon instance uses Amazon ECS-Optimized Linux AMI. This is the recommended image to run ECS container service. The key components of this base image are:
. Amazon Linux AMI
. Amazon ECS Container Agent – manages containers lifecycle on behalf of ECS and allows them to connect to the cluster
. Docker Engine

Task:: A task is defined as a JSON file and describes an application that contains one or more container definitions. This usually points to Docker images from a registry, port/volume mapping, etc.

Service:: ECS maintains the "`desired state`" of your application. This is achieved by creating a service. A service specifies the number of instances of a task definition that needs to run at a given time. If the task in a service becomes unhealthy or stop running, then the service scheduler will bounce the task. It ensures that the desired and actual state are match. This is what provides resilience in ECS.New tasks within a Service are balanced across Availability Zones in your cluster. Service scheduler figures out which container instances can meet the needs of a service and schedules it on a valid container instance in an optimal Availability Zone (one with the fewest number of tasks running).

## <a name="pre-requisites"></a>Pre-requisites

### <a name="setup-cloud9"></a>Setup Cloud9
1. Click the link [here](https://ap-southeast-1.console.aws.amazon.com/cloud9/home/product?region=ap-southeast-1) to go to Cloud9 console. Sign in with your credentials if necessary. You need to be in **Singapore** region for this lab.

2. Click on **Create Environment**.

3. Give any appropriate name and description to your environment. Click on **Next**.

4. Choose an instance type and click on **Next**.

5. Click on **Create Environment**.

6. After a few minutes, when your environment is up, you will be redirected to the Cloud9 IDE.

### <a name="resize-ebs-storage"></a>Resize EBS storage

Create a script file named resize.sh and use the code provided [here](https://docs.aws.amazon.com/cloud9/latest/user-guide/move-environment.html#move-environment-resize) based on the distro used.

Execute the script to resize EBS to 100GB
```
$ sh resize.sh 100
```
Reboot instance from the EC2 console

### <a name="install-docker-composer"></a>Install Docker composer
 [Install Docker Compose | Docker Documentation](https://docs.docker.com/compose/install/)
```
$ sudo curl -L "https://github.com/docker/compose/releases/download/1.25.5/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

$ sudo chmod +x /usr/local/bin/docker-compose

$ docker-compose --version
```

## <a name="chat-application-on-docker--local-"></a>Chat application on Docker (Local)

Clone repo https://github.com/enghwa/RoRChat-cdk.git
```
$ cd RoRChat-cdk/
$ git clone https://github.com/enghwa/RoRChat RoRChat
$ cd RoRChat
```

Add the RoRChat app to your Github account:
* Create a new github repo and commit the `RoRChat` application sub-folder.
* Create a Github Access token and store the token in AWS SSM Secret Manager - https://docs.aws.amazon.com/codepipeline/latest/userguide/GitHub-create-personal-token-CLI.html
* update `bin/ror_r_chat-cdk.ts` line 37-39.

Build the docker container locally for the RoR6 chat app
```
$ docker build -t ror6dev --build-arg USER_ID=$(id -u) --build-arg GROUP_ID=$(id -g) .
```

Setup the database
```
$ docker-compose run  --user "$(id -u):$(id -g)" -p8080:8010  ror6 bundle exec rake db:setup 
```

Bring up the app with mySQL and Redis locally
```
$ docker-compose run  --user "$(id -u):$(id -g)" -p8080:8010  ror6
```

Preview the application in Cloud9 and it will show an error to add an entry into config.

Add the following line to the end of the file /config/environments/development.rb
```
#example, dont copy
  config.hosts << "cb2c7446f879462c897b3a79679d8e59.vfs.cloud9.ap-southeast-1.amazonaws.com"
```

Bring up the app with mySQL and Redis locally again
```
$ docker-compose run  --user "$(id -u):$(id -g)" -p8080:8010  ror6
```

Access application in a seperate browser tab

## <a name="chat-application-on-ecs"></a>Chat application on ECS

Initialize the cdk repo
```
# go back to root folder RoRChat-cdk/
cd ..

$ npm install

$ npm run build
```

Build the vpc
```
$ cdk synth

$ npm run build

$ cdk deploy ror6Vpc
```

Build db/redis
```
$ cdk list

$ npm run build

$ cdk deploy postgresDBRedis
```

Build alb/fargate/ROR6 chat
```
$ cdk list

$ npm run build

$ cdk deploy RoRFargate
```

An error mentioning to bootstrap the environment will be displayed
```
$ cdk bootstrap aws://556129231893/ap-southeast-1

$ cdk deploy RoRFargate
```

## <a name="custom-domain-name-alb"></a>Custom domain name for Load balancer with SSL

The ECS pattern `ApplicationLoadBalancedFargateService` requires using a hosted zone in Route53 to enables HTTPS. Instead we will create the certificate and add a TLS listener to the ALB using the aws cli. 

In order to configure TLS on the ALB listener, we will need a SSL certificate which can be requested/managed through the Amazon Certificate Manager service (replacing example.com with your domain).

```
aws acm request-certificate \
  --domain-name www.example.com \
  --subject-alternative-names "example.com" \
  --validation-method DNS
```
This will return output like this:

```
{
    "CertificateArn": "arn:aws:acm:ap-southeast-1:123456789012:certificate/aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb"
}
```
Use the Amazon Resource Name (ARN) from the command above to query and get the DNS CNAME record you need to add to your domain provider. This will then facilitate getting the cerificate validated.

Create a DNS record that will need to be added to your domain using the ACM DNS value from the output above to validate certificate

```
aws acm describe-certificate \
  --certificate-arn arn:aws:acm:ap-southeast-1:123456789012:certificate/aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb \
  --query 'Certificate.DomainValidationOptions'

```

This will return output like this:

```
[
{
    "DomainName": "www.example.com",
    "ValidationDomain": "www.example.com",
    "ValidationStatus": "PENDING_VALIDATION",
    "ResourceRecord": {
        "Name": "_fe11e6d33b981de0a491ad26bcd6ba11.www.example.com.",
        "Type": "CNAME",
        "Value": "_4acexxxx6fec33b8cbyyy5bf19d22dd5.auiqqraehs.acm-validations.aws."
    },
    "ValidationMethod": "DNS"
},
{
    "DomainName": "example.com",
    "ValidationDomain": "example.com",
    "ValidationStatus": "PENDING_VALIDATION",
    "ResourceRecord": {
        "Name": "_30dd99eaeba12db5b3c6eb66a7848fbb.example.com.",
        "Type": "CNAME",
        "Value": "_5e79ba4de5aaa5eda715fzzzz384451.auiqqraehs.acm-validations.aws."
    },
    "ValidationMethod": "DNS"
}
]
```
Use the `ResourceRecord` information to create the DNS record in your domain provider by adding a CNAME record to validate the certificate. This might take a bit for ACM to validate the certificate but keep checking the status of the certificate by running the aws `acm describe-certificate` command and waiting until the output returns SUCCESS for the ValidationStatus like the below example output:

```
[
{
    "DomainName": "www.example.com",
    "ValidationDomain": "www.example.com",
    "ValidationStatus": "SUCCESS",
    "ResourceRecord": {
        "Name": "_fe11e6d33b981de0a491ad26bcd6ba11.www.example.com.",
        "Type": "CNAME",
        "Value": "_4acexxxx6fec33b8cbyyy5bf19d22dd5.auiqqraehs.acm-validations.aws."
    },
    "ValidationMethod": "DNS"
},
{
    "DomainName": "example.com",
    "ValidationDomain": "example.com",
    "ValidationStatus": "SUCCESS",
    "ResourceRecord": {
        "Name": "_30dd99eaeba12db5b3c6eb66a7848fbb.example.com.",
        "Type": "CNAME",
        "Value": "_5e79ba4de5aaa5eda715fzzzz384451.auiqqraehs.acm-validations.aws."
    },
    "ValidationMethod": "DNS"
}
]
```

Create ALB Listener Rule using the following information
* certificate ARN
* ALB ARN
* Target Group ARN

Get your ALB ARN

```
aws elbv2 describe-load-balancers \
  --query 'LoadBalancers[*].LoadBalancerArn' \
  | grep RoR
```
This will return output like this:

```
"arn:aws:elasticloadbalancing:ap-southeast-1:123456789012:loadbalancer/app/RoRFa-RoRap-abcdefghijklmnop"
```

Get your Target Group ARN
```
aws elbv2 describe-target-groups \
  --query 'TargetGroups[*].TargetGroupArn' \
  | grep RoRFa
```

This will return output like this:

```
"arn:aws:elasticloadbalancing:ap-southeast-1:123456789012:targetgroup/RoRFa-RoRap-0123456789abcdef"
```
Use the values retrieved above to create the listener:

```
aws elbv2 create-listener \
  --protocol HTTPS --port 443 \
  --load-balancer-arn="arn:aws:elasticloadbalancing:ap-southeast-1:123456789012:loadbalancer/app/RoRFa-RoRap-abcdefghijklmnop" \
  --default-actions "Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:ap-southeast-1:123456789012:targetgroup/RoRFa-RoRap-0123456789abcdef" \
  --certificates "CertificateArn=arn:aws:acm:ap-southeast-1:123456789012:certificate/aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb" \
  --ssl-policy ELBSecurityPolicy-2016-08
```

Get the DNS name of the ALB and add it as a CNAME record in your domain provider. 
```
aws elbv2 describe-load-balancers \
  --query 'LoadBalancers[*].DNSName' \
  | grep RoR
```
This will return output like this:

```
"RoRFa-RoRap-0123456789abcdef.ap-southeast-1.elb.amazonaws.com"
```
Use the above and create a CNAME record in your domain provider.

## <a name="ci-cd"></a>CI/CD


```
$ cdk deploy RoRChatCiCd
```
