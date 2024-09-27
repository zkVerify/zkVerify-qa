#!/bin/bash
set -eou pipefail

# Default values
rebuild=0
fetch_latest=0
zkverify_version="main"
nh_attestation_bot_branch="main"
zkv_attestation_contracts_branch="main"

# Command-line options
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --rebuild) rebuild=1 ;;
        --fetch-latest) fetch_latest=1 ;;
        --zkverify-branch) zkverify_version="$2"; shift ;;
        --nh-attestation-bot-branch) nh_attestation_bot_branch="$2"; shift ;;
        --zkv-attestation-contracts-branch) zkv_attestation_contracts_branch="$2"; shift ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

# Repositories information
repo_names=("zkVerify" "nh-attestation-bot" "zkv-attestation-contracts")
repo_urls=("https://github.com/HorizenLabs/zkVerify.git" "https://github.com/HorizenLabs/NH-attestation-bot.git" "https://github.com/HorizenLabs/zkv-attestation-contracts.git")
repo_branches=("$zkverify_version" "$nh_attestation_bot_branch" "$zkv_attestation_contracts_branch")
repo_count=${#repo_names[@]}


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

        # Debugging: List available branches, tags, and recent commits
        echo "Available branches:"
        git branch -a
        echo "Available tags:"
        git tag -l
        echo "Latest commits:"
        git log --oneline -n 5

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


echo "Configuring and bootstrapping zkVerify..."
cd services/zkVerify || exit 1

# Source config
if [[ -f "cfg" ]]; then
    source cfg
else
    echo "Configuration file not found at the top level, check the path and filename."
    exit 1
fi

image_name="horizenlabs/zkverify"

if [[ "${rebuild}" -eq 1 ]]; then
    containers=$(docker ps -a -q --filter ancestor="${image_name}:${zkverify_version}")
    if [[ -n "${containers}" ]]; then
        echo "Stopping and removing containers using the image ${image_name}:${zkverify_version}..."
        docker stop "${containers}"
        docker rm -f "${containers}"
    fi

    if docker images -q "${image_name}:${zkverify_version}"; then
        echo "Removing image ${image_name}:${zkverify_version}..."
        docker rmi -f "${image_name}:${zkverify_version}"
    fi

    if [[ -f "docker/dockerfiles/zkv-node.Dockerfile" ]]; then
        echo "Building zkVerify image with tag: ${zkverify_version}"
        docker build -f docker/dockerfiles/zkv-node.Dockerfile -t "${image_name}:${zkverify_version}" .
        echo "zkVerify image tagged as ${image_name}:${zkverify_version}"
        echo "zkVerify is set up and ready."
    else
        echo "zkv-node.Dockerfile not found in 'docker/dockerfiles/', check the path and filename."
        exit 1
    fi
fi

cd ../..

echo "Setup completed."
