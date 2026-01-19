#!/usr/bin/env bash

set -euo pipefail

usage() {
    cat <<EOF
Usage: $(basename "$0") <markdown_file>

Creates a new Hugo post from a markdown file.

Arguments:
  markdown_file    Path to the markdown file to convert into a post
EOF
    exit 1
}

# Check if markdown file argument is provided
if [[ $# -ne 1 ]]; then
    usage
fi

input_file="$1"

if [[ ! -f "$input_file" ]]; then
    echo "Error: File '$input_file' not found" >&2
    exit 1
fi

echo -n "Enter post slug (e.g., 'my-awesome-post'): "
read -r slug

hugo new "post/${slug}.md"

formatted_content=$(mdformat "$input_file")

post_file="content/posts/${slug}.md"
echo "" >> "$post_file"
echo "$formatted_content" >> "$post_file"

echo "✓ Post created successfully at: $post_file"
