#!/bin/bash

# ki - Cross-tool skill manager
# https://github.com/levelio/ki

set -e

REPO="levelio/ki"
BINARY_NAME="ki"
INSTALL_DIR="/usr/local/bin"
LATEST_RELEASE_URL="https://api.github.com/repos/${REPO}/releases/latest"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

success() {
  echo -e "${GREEN}✓${NC} $1"
}

warn() {
  echo -e "${YELLOW}!${NC} $1"
}

error() {
  echo -e "${RED}✗${NC} $1"
  exit 1
}

# Detect OS
detect_os() {
  case "$(uname -s)" in
    Darwin*) echo "darwin" ;;
    Linux*)  echo "linux" ;;
    CYGWIN*|MINGW*|MSYS*)  echo "windows" ;;
    *)       error "Unsupported OS: $(uname -s)" ;;
  esac
}

# Detect architecture
detect_arch() {
  case "$(uname -m)" in
    x86_64|amd64)   echo "x64" ;;
    arm64|aarch64)  echo "arm64" ;;
    *)              error "Unsupported architecture: $(uname -m)" ;;
  esac
}

# Get latest version
get_latest_version() {
  if command -v curl &> /dev/null; then
    curl -fsSL "$LATEST_RELEASE_URL" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/'
  elif command -v wget &> /dev/null; then
    wget -qO- "$LATEST_RELEASE_URL" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/'
  else
    error "curl or wget is required"
  fi
}

# Download file
download() {
  local url="$1"
  local output="$2"

  if command -v curl &> /dev/null; then
    curl -fsSL "$url" -o "$output"
  elif command -v wget &> /dev/null; then
    wget -q "$url" -O "$output"
  fi
}

# Main installation
main() {
  echo -e "${BLUE}"
  echo "  ╔════════════════════════════════════╗"
  echo "  ║        ki Skill Manager            ║"
  echo "  ║    https://github.com/levelio/ki   ║"
  echo "  ╚════════════════════════════════════╝"
  echo -e "${NC}"
  echo

  # Check if ki is already installed
  if command -v ki &> /dev/null; then
    local current_version
    current_version=$(ki --version 2>/dev/null || echo "unknown")
    info "Current version: $current_version"
  fi

  # Detect platform
  local os=$(detect_os)
  local arch=$(detect_arch)
  info "Detected: $os/$arch"

  # Get latest version
  info "Fetching latest version..."
  local version=$(get_latest_version)

  if [ -z "$version" ]; then
    error "Failed to get latest version"
  fi

  info "Latest version: $version"

  # Build download URL
  local binary_name
  if [ "$os" = "windows" ]; then
    binary_name="${BINARY_NAME}-${os}-${arch}.exe"
  else
    binary_name="${BINARY_NAME}-${os}-${arch}"
  fi

  local download_url="https://github.com/${REPO}/releases/download/${version}/${binary_name}"

  # Create temp file
  local temp_file=$(mktemp)
  trap "rm -f $temp_file" EXIT

  # Download
  info "Downloading ${binary_name}..."
  download "$download_url" "$temp_file"

  if [ ! -s "$temp_file" ]; then
    error "Download failed or file is empty"
  fi

  # Make executable
  chmod +x "$temp_file"

  # Determine install directory
  local install_dir="$INSTALL_DIR"
  local use_sudo=""

  # Check if we can write to install dir
  if [ ! -w "$install_dir" ]; then
    if [ -w "$HOME/.local/bin" ]; then
      install_dir="$HOME/.local/bin"
      info "Using $install_dir (no sudo required)"
    else
      use_sudo="sudo"
      warn "Will use sudo to install to $install_dir"
    fi
  fi

  # Create directory if needed
  if [ ! -d "$install_dir" ]; then
    mkdir -p "$install_dir" 2>/dev/null || $use_sudo mkdir -p "$install_dir"
  fi

  # Install
  info "Installing to $install_dir/$BINARY_NAME..."
  if [ -n "$use_sudo" ]; then
    $use_sudo mv "$temp_file" "$install_dir/$BINARY_NAME"
  else
    mv "$temp_file" "$install_dir/$BINARY_NAME"
  fi

  # Check PATH
  if [[ ":$PATH:" != *":$install_dir:"* ]]; then
    warn "$install_dir is not in PATH"
    echo
    echo "Add this to your shell config (~/.bashrc, ~/.zshrc, etc.):"
    echo ""
    echo -e "${YELLOW}  export PATH=\"\$PATH:$install_dir\"${NC}"
    echo ""
    echo "Then run: source ~/.bashrc  (or ~/.zshrc)"
  fi

  # Done
  echo
  success "Installation complete!"
  echo
  echo "  Version:    $version"
  echo "  Location:   $install_dir/$BINARY_NAME"
  echo
  echo "  Quick start:"
  echo ""
  echo -e "    ${GREEN}ki init${NC}        # Initialize config"
  echo -e "    ${GREEN}ki list${NC}        # List available skills"
  echo -e "    ${GREEN}ki install${NC}     # Install skills"
  echo ""

  # Verify installation
  if command -v ki &> /dev/null; then
    ki --version
  fi
}

main "$@"
