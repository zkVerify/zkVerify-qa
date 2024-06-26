#!/bin/bash
set -eou pipefail

# Command-line options
rebuild=0
fetch_latest=0
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --rebuild) rebuild=1 ;;
        --fetch-latest) fetch_latest=1 ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

# Repositories
repo_names=("zkVerify" "nh-attestation-bot" "zkv-attestation-contracts")
repo_urls=("https://github.com/HorizenLabs/zkVerify.git" "https://github.com/HorizenLabs/NH-attestation-bot.git" "https://github.com/HorizenLabs/zkv-attestation-contracts.git")
repo_branches=("main" "main" "main")
repo_count=${#repo_names[@]}

# Check if running in GitHub Actions
if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
  echo "Running in GitHub Actions... Using pre-built zkVerify Docker image."
  if [ -z "${GH_TOKEN:-}" ]; then
    echo "Error: GH_TOKEN is not set. Please set it as a secret in your GitHub Actions workflow."
    exit 1
  fi
  auth_prefix="https://${GH_TOKEN}@"
  use_prebuilt_image=true
else
  echo "Running locally. Using default authentication."
  auth_prefix=""
  use_prebuilt_image=false
fi

# Clone each repository into the services directory or fetch latest updates
for ((i=0; i<repo_count; i++)); do
  repo=${repo_names[$i]}
  repo_url=${repo_urls[$i]}
  repo_branch=${repo_branches[$i]}
  target_dir="./services/$repo"

  if [ ! -d "$target_dir" ]; then
    echo "Directory $target_dir does not exist. Cloning..."
    if [ -n "$auth_prefix" ]; then
      # Running in GitHub Actions
      git clone -b "$repo_branch" "${auth_prefix}${repo_url#https://}" "$target_dir"
    else
      # Running locally
      git clone -b "$repo_branch" "${repo_url}" "$target_dir"
    fi
    echo "Repository $repo cloned successfully."
  else
    echo "Directory $target_dir already exists."
    if [ "$fetch_latest" -eq 1 ]; then
      echo "Fetching latest for $repo..."
      (cd "$target_dir" && git pull origin "$repo_branch")
    else
      echo "Skipping update for $repo."
    fi
  fi
done

if [ "$use_prebuilt_image" = false ]; then
  echo "Pre-built image not selected... Configuring and bootstrapping zkVerify..."
  cd services/zkVerify || exit 1

  # Source config
  if [ -f "cfg" ]; then
      source cfg
  else
      echo "Configuration file not found at the top level, check the path and filename."
      exit 1
  fi

  # Check if Docker image exists and rebuild if not or if rebuild flag is passed in
  image_name="horizenlabs/zkverify"
  if [[ $(docker images -q "$image_name") && "$rebuild" -eq 0 ]]; then
      echo "Image $image_name already exists and no rebuild requested, skipping bootstrap."
  else
      echo "Image $image_name does not exist or rebuild requested, running bootstrap..."

      containers=$(docker ps -a -q --filter ancestor="$image_name")
      if [ -n "$containers" ]; then
          echo "Stopping and removing containers using the image $image_name..."
          docker stop $containers
          docker rm -f $containers
      fi

      if docker images -q "$image_name"; then
          echo "Removing image $image_name..."
          docker rmi -f "$image_name"
      fi

      if [ -f "docker/scripts/bootstrap.sh" ]; then
          chmod +x docker/scripts/bootstrap.sh
          ./docker/scripts/bootstrap.sh
          echo "zkVerify is set up and ready."
      else
          echo "Bootstrap script not found in 'docker/scripts/', check the path and filename."
          exit 1
      fi
  fi

  cd ../..
fi

echo "Setup completed."
