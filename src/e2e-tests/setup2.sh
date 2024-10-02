#!/bin/bash
set -eou pipefail

# Default values
rebuild=0
fetch_latest=0
docker_image_tag=""
zkverify_version=""
nh_attestation_bot_branch="main"
zkv_attestation_contracts_branch="main"
local_zkv_image_tag=${LOCAL_IMAGE_TAG}

# Command-line options
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --rebuild) rebuild=1 ;;
        --fetch-latest) fetch_latest=1 ;;
        --zkverify-branch) zkverify_version="$2"; shift ;;
        --nh-attestation-bot-branch) nh_attestation_bot_branch="$2"; shift ;;
        --zkv-attestation-contracts-branch) zkv_attestation_contracts_branch="$2"; shift ;;
        --docker-image-tag) docker_image_tag="$2"; shift ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

# Repositories information
repo_names=("zkVerify" "nh-attestation-bot" "zkv-attestation-contracts")
repo_urls=("https://github.com/HorizenLabs/zkVerify.git" "https://github.com/HorizenLabs/NH-attestation-bot.git" "https://github.com/HorizenLabs/zkv-attestation-contracts.git")
repo_branches=("$zkverify_version" "$nh_attestation_bot_branch" "$zkv_attestation_contracts_branch")
repo_count=${#repo_names[@]}

function check_docker_hub_image() {
    local image_name=$1
    local tag=$2
    if curl --silent --fail "https://hub.docker.com/v2/repositories/${image_name}/tags/${tag}/" > /dev/null; then
        return 0
    else
        return 1
    fi
}

function check_local_image() {
    local image_name=$1
    local tag=$2

    image_id=$(docker images -q ${image_name}:${tag})

    if [[ -n "$image_id" ]]; then
        echo "Image ${image_name}:${tag} exists."
        return 0
    else
        echo "Image ${image_name}:${tag} does not exist."
        return 1
    fi
}

function build_zkverify_image() {
    echo "Configuring and bootstrapping zkVerify..."
    cd services/zkVerify || exit 1

    # Source config
    if [[ -f "cfg" ]]; then
        source cfg
    else
        echo "Configuration file not found at the top level, check the path and filename."
        exit 1
    fi

    if [[ -f "docker/dockerfiles/zkv-node.Dockerfile" ]]; then
        echo "Building zkVerify image with tag: ${local_zkv_image_tag}"
        docker build -f docker/dockerfiles/zkv-node.Dockerfile -t "${image_name}:${local_zkv_image_tag}" .
        echo "zkVerify image tagged as ${image_name}:${local_zkv_image_tag}"
        echo "zkVerify is set up and ready."
    else
        echo "zkv-node.Dockerfile not found in 'docker/dockerfiles/', check the path and filename."
        exit 1
    fi
}

# Check that proper values are passed in

# Either docker_image_tag or zkverify_version is provided
# if zkverify_version is provided, local_zkv_image_tag is also provided

# Check if running in GitHub Actions
if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
    if [ -z "${GH_TOKEN:-}" ]; then
        echo "Error: GH_TOKEN is not set. Please set it as a secret in your GitHub Actions workflow."
        exit 1
    fi
    auth_prefix="https://${GH_TOKEN}@"
else
    auth_prefix=""
fi

# Clone or update repositories
for ((i=0; i<repo_count; i++)); do
    repo=${repo_names[$i]}
    repo_url=${repo_urls[$i]}
    repo_branch_or_tag=${repo_branches[$i]}
    target_dir="./services/$repo"

    if [ ! -d "$target_dir" ]; then
        echo "Directory $target_dir does not exist. Cloning..."
        if [ -n "$auth_prefix" ]; then
            # Running in GitHub Actions
            git clone --no-single-branch "${auth_prefix}${repo_url#https://}" "$target_dir"
        else
            # Running locally
            git clone --no-single-branch "$repo_url" "$target_dir"
        fi
        echo "Repository $repo cloned successfully."
    else
        echo "Directory $target_dir already exists."
        if [ "$fetch_latest" -eq 1 ]; then
            echo "Fetching latest for $repo..."
            (cd "$target_dir" && git fetch --all)
        else
            echo "Skipping update for $repo."
        fi
    fi

    # Checkout the specific branch, tag, or commit hash
    (
        cd "$target_dir"

        # Attempt to checkout as branch or tag
        if git rev-parse --verify "$repo_branch_or_tag" >/dev/null 2>&1; then
            git checkout "$repo_branch_or_tag"
            echo "Checked out ${repo_branch_or_tag} for ${repo}."
        else
            # Assume it's a commit hash
            echo "Attempting to fetch and checkout commit hash ${repo_branch_or_tag}..."
            git fetch origin "$repo_branch_or_tag" || { echo "Failed to fetch commit ${repo_branch_or_tag}"; exit 1; }
            git checkout "$repo_branch_or_tag" || { echo "Failed to checkout commit ${repo_branch_or_tag}"; exit 1; }
            echo "Checked out commit ${repo_branch_or_tag} for ${repo}."
        fi
    )
done

# If zkveriy_docker_image is specified, check Docker Hub and pull image.
# If zkverify_version is specified & rebuild is false, check local image and build image if it does not exist.
# If zkverify-version is specified & rebuild is true, delete local image with the same tag and rebuild.
image_name="horizenlabs/zkverify"
if [ -n "${docker_image_tag}" ]; then
    echo "docker_image_tag provided"

    if check_docker_hub_image "$image_name" "$docker_image_tag"; then
        echo "Using Docker Hub image ${image_name}:${docker_image_tag}."
        docker pull "${image_name}:${docker_image_tag}"
    else
        echo "Error: Image ${image_name}:${docker_image_tag} not found on Docker Hub."
        exit 1
    fi

elif [ -n "${zkverify_version}" ] && [[ "$rebuild" -eq 0 ]]; then
    echo "docker_image_tag not provided. zkverify_version ${zkverify_version} and rebuild=false."

    if check_local_image "$image_name" "$local_zkv_image_tag"; then
        echo "Using locally available image ${image_name}:${local_zkv_image_tag}."
    else
        echo "Image ${image_name}:${local_zkv_image_tag} not found locally. Building the image..."
        build_zkverify_image
    fi

elif [ -n "${zkverify_version}" ] && [[ "$rebuild" -eq 1 ]]; then
    echo "docker_image_tag not provided. zkverify_version ${zkverify_version} and rebuild=true"

    containers=$(docker ps -a -q --filter ancestor="${image_name}:${local_zkv_image_tag}")
    if [ -n "$containers" ]; then
        echo "Stopping and removing containers using the image ${image_name}:${local_zkv_image_tag}..."
        docker stop $containers
        docker rm -f $containers
    fi

    if docker images -q "${image_name}:${local_zkv_image_tag}"; then
        echo "Removing image ${image_name}:${local_zkv_image_tag}..."
        docker rmi -f "${image_name}:${local_zkv_image_tag}"
    fi

    build_zkverify_image
fi

cd ../..

echo "Setup completed."
