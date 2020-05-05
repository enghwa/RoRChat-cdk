import * as cdk from '@aws-cdk/core';
import { SecretValue } from "@aws-cdk/core";
import ecr = require('@aws-cdk/aws-ecr');
import codebuild = require("@aws-cdk/aws-codebuild");
import codepipeline = require("@aws-cdk/aws-codepipeline");
import {
  CodeBuildAction,
  GitHubSourceAction,
  GitHubTrigger,
  ManualApprovalAction,
  EcsDeployAction,
  LambdaInvokeAction
} from "@aws-cdk/aws-codepipeline-actions";
import { BuildSpec, Cache } from "@aws-cdk/aws-codebuild";
import ecs = require('@aws-cdk/aws-ecs');
// import * as sns from '@aws-cdk/aws-sns';
// import lambda = require('@aws-cdk/aws-lambda');
// import logs = require('@aws-cdk/aws-logs');

export interface CiCdProps extends cdk.StackProps {
  rorChatService: ecs.IBaseService,
  ecrRepo: string
  githubOwner: string,
  githubRepo: string,
  githubOauthTokenSSM: string
}

export class CiCdStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: CiCdProps) {
    super(scope, id, props);

    const ecrRepo = ecr.Repository.fromRepositoryName(this, 'EcrRepo', props.ecrRepo)

    const buildProject = new codebuild.PipelineProject(this, "Build", {
      description: "Build Ruby on Rails application",
      projectName: "ror6_chat_build",
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_4_0, // aws codebuild list-curated-environment-images
        computeType: codebuild.ComputeType.MEDIUM,
        privileged: true //we are building docker containers
      },
      environmentVariables: {
        'REPOSITORY_NAME': {
          value: ecrRepo.repositoryName,
        },
        'REPOSITORY_URI': {
          value: ecrRepo.repositoryUri,
        }
      },
      cache: Cache.local(codebuild.LocalCacheMode.DOCKER_LAYER),
      buildSpec: BuildSpec.fromObject({
        version: 0.2,
        phases: {
          install: {
            'runtime-versions': {
              docker: 19 //https://github.com/aws/aws-codebuild-docker-images/blob/master/ubuntu/standard/4.0/runtimes.yml
            }
          },
          pre_build: {
            commands: [
              "echo Logging in to Amazon ECR...",
              "$(aws ecr get-login --region $AWS_DEFAULT_REGION --no-include-email)",
              "IMAGE_TAG=$CODEBUILD_RESOLVED_SOURCE_VERSION"
            ]
          },
          build: {
            commands: [
              "echo Build started on `date`",
              "echo Build the Docker image for $REPOSITORY_NAME with image tag $IMAGE_TAG",
              "docker build -t $REPOSITORY_NAME:$IMAGE_TAG -f Dockerfile.fargate .",
              "docker tag $REPOSITORY_NAME:$IMAGE_TAG $REPOSITORY_URI:$IMAGE_TAG"
            ]
          },
          post_build: {
            commands: [
              "echo Build completed on`date`",
              "echo Pushing the Docker image...",
              "aws ecr put-image-scanning-configuration --repository-name $REPOSITORY_NAME --image-scanning-configuration scanOnPush=true",
              "docker push $REPOSITORY_URI:$IMAGE_TAG",
              "printf '[{\"name\":\"web\",\"imageUri\":\"%s\"}]' $REPOSITORY_URI:$IMAGE_TAG > imagedefinitions.json",
              "cat imagedefinitions.json"
            ]
          }
        },
        artifacts: {
          files: 'imagedefinitions.json',
        }
      })
    });
    ecrRepo.grant(buildProject, "ecr:PutImageScanningConfiguration")
    ecrRepo.grantPullPush(buildProject)


    //------- ------------------- ------- ------------------- ------- ------------------- 
    const sourceOutput = new codepipeline.Artifact();
    const buildOutput = new codepipeline.Artifact();

    const sourceAction = new GitHubSourceAction({
      actionName: "GitHub",
      owner: props.githubOwner,
      repo: props.githubRepo,
      oauthToken: SecretValue.secretsManager(props.githubOauthTokenSSM),
      output: sourceOutput,
      branch: "master",
      trigger: GitHubTrigger.WEBHOOK // aws codepipeline list-webhooks --endpoint-url "https://codepipeline.ap-southeast-1.amazonaws.com"
    });

    const buildAction = new CodeBuildAction({
      input: sourceOutput,
      actionName: "Build",
      project: buildProject,
      outputs: [buildOutput]
    });

    const manualApprovalAction = new ManualApprovalAction({
      actionName: 'Approve',
      // notifyEmails: ""
    });

    const deployToEcs = new EcsDeployAction({
      actionName: 'DeployAction',
      service: props?.rorChatService,
      imageFile: new codepipeline.ArtifactPath(buildOutput, `imagedefinitions.json`)
    });

    new codepipeline.Pipeline(this, "Pipeline", {
      pipelineName: "RoRChatPipeline",
      stages: [
        { actions: [sourceAction], stageName: "Source" },
        { actions: [buildAction], stageName: "Build" },
        { actions: [manualApprovalAction], stageName: "Approval" },
        { actions: [deployToEcs], stageName: "Deployment" }
      ]
    });
  }
}
