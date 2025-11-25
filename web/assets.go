package web

import (
	"embed"
	"io/fs"
)

//go:embed dist/*
var distFS embed.FS

func Assets() fs.FS {
	sub, _ := fs.Sub(distFS, "dist")
	return sub
}

//go:embed dist/index.html
var indexHtml string

func IndexHtml() string {
	return indexHtml
}
