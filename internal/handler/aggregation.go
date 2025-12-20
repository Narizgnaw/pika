package handler

import "strings"

func normalizeAggregation(raw string) string {
	value := strings.ToLower(strings.TrimSpace(raw))
	if value == "max" {
		return value
	}
	return "avg"
}
