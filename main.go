package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

// フロントエンド（Svelte）のビルド成果物を埋め込む。
// ゲームのロジックはすべてフロント側にあるため、Web 静的配信でも単体で動作する。
//
//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := NewApp()

	err := wails.Run(&options.App{
		Title:            "Numvil",
		Width:            720,
		Height:           960,
		MinWidth:         400,
		MinHeight:        600,
		AssetServer:      &assetserver.Options{Assets: assets},
		BackgroundColour: &options.RGBA{R: 245, G: 243, B: 255, A: 1},
		OnStartup:        app.startup,
		Bind:             []interface{}{app},
		Windows: &windows.Options{
			Theme: windows.Light,
		},
		Linux: &linux.Options{
			ProgramName: "Numvil",
		},
	})
	if err != nil {
		println("Error:", err.Error())
	}
}
