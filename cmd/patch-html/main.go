package main

import (
	"fmt"
	"os"
	"strings"
)

func main() {
	// 读取 web/dist/index.html
	htmlPath := "web/dist/index.html"
	content, err := os.ReadFile(htmlPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "读取文件失败: %v\n", err)
		os.Exit(1)
	}

	html := string(content)

	// 检查是否已经包含模板代码（避免重复插入）
	if strings.Contains(html, "{{.CustomJS}}") {
		fmt.Println("模板代码已存在，跳过插入")
		return
	}

	// 在 </head> 前插入模板代码
	customTemplate := `    <script type="application/javascript">
        {{.CustomJS}}
    </script>
    <style type="text/css">
        {{.CustomCSS}}
    </style>
`

	// 替换 </head>
	newHTML := strings.Replace(html, "</head>", customTemplate+"</head>", 1)

	// 写回文件
	err = os.WriteFile(htmlPath, []byte(newHTML), 0644)
	if err != nil {
		fmt.Fprintf(os.Stderr, "写入文件失败: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("✓ 成功添加自定义模板到 index.html")
}
