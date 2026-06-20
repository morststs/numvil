FROM golang:1.23-bookworm

# Wails / クロスコンパイルに必要なシステム依存
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    git \
    libgtk-3-dev \
    libwebkit2gtk-4.0-dev \
    libwebkit2gtk-4.1-dev \
    build-essential \
    pkg-config \
    gcc-mingw-w64-x86-64 \
    nsis \
    && rm -rf /var/lib/apt/lists/*

# Node.js 22 LTS（Svelte 5 / Vite 7 は Node 20.19+ / 22.12+ が必要）
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && node -v && npm -v

# Wails CLI（リファレンス同様にバージョン固定）
RUN go install github.com/wailsapp/wails/v2/cmd/wails@v2.12.0
ENV PATH="/go/bin:${PATH}"

WORKDIR /app

CMD ["bash", "scripts/build.sh"]
