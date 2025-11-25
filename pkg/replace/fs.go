package replace

import (
	"net/http"
)

type Replace func(name string, file http.File) (http.File, error)

func FS(fs http.FileSystem, replace Replace) http.FileSystem {
	return &replacerFS{
		FileSystem: fs,
		Replace:    replace,
	}
}

type replacerFS struct {
	http.FileSystem
	Replace
}

func (f *replacerFS) Open(name string) (http.File, error) {
	file, err := f.FileSystem.Open(name)
	if err != nil {
		return nil, err
	}
	replaced, err := f.Replace(name, file)
	if err != nil {
		return nil, err
	}
	return replaced, nil
}
