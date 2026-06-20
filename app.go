package main

import "context"

// App は Wails のライフサイクル用の最小限の構造体。
// 計算ロジックはフロントエンド（frontend/src/lib/engine.js）に実装しているため、
// バックエンドにビジネスロジックは持たない。
type App struct {
	ctx context.Context
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}
