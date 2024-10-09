#!/bin/bash
set -eou pipefail

docker_image_tag="latest"
image_name="horizenlabs/zkverify"

docker pull "${image_name}:${docker_image_tag}"

# Save the Docker image as a tarball
script_dir="$(dirname "$(realpath "$0")")"
echo "Saving image ${image_name}:${docker_image_tag} to ${script_dir}/zkverify-image.tar"
docker save "${image_name}:${docker_image_tag}" -o "${script_dir}/zkverify-image.tar"

echo "Setup completed."
