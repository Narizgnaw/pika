package service

import (
	"testing"

	"github.com/pika-monitor/pika/internal/vmclient"
)

func TestAggregateMonitorSparklines(t *testing.T) {
	result := &vmclient.QueryResult{
		Data: vmclient.ResultData{Result: []vmclient.Result{
			{
				Metric: map[string]string{"monitor_id": "monitor-a", "agent_id": "agent-1"},
				Values: [][]interface{}{{float64(100), "100"}, {float64(160), "200"}},
			},
			{
				Metric: map[string]string{"monitor_id": "monitor-a", "agent_id": "agent-2"},
				Values: [][]interface{}{{float64(100), "300"}, {float64(160), "400"}},
			},
			{
				Metric: map[string]string{"monitor_id": "private-monitor", "agent_id": "agent-1"},
				Values: [][]interface{}{{float64(100), "999"}},
			},
		}},
	}

	sparklines := aggregateMonitorSparklines(result, map[string]struct{}{"monitor-a": {}})
	points := sparklines["monitor-a"]
	if len(points) != 2 {
		t.Fatalf("expected 2 points, got %d", len(points))
	}
	if points[0].Timestamp != 100000 || points[0].Avg != 200 || points[0].Max != 300 {
		t.Fatalf("unexpected first point: %+v", points[0])
	}
	if points[1].Timestamp != 160000 || points[1].Avg != 300 || points[1].Max != 400 {
		t.Fatalf("unexpected second point: %+v", points[1])
	}
	if _, exists := sparklines["private-monitor"]; exists {
		t.Fatal("unexpected private monitor sparkline")
	}
}

func TestAggregateMonitorSparklinesSkipsMalformedValues(t *testing.T) {
	result := &vmclient.QueryResult{
		Data: vmclient.ResultData{Result: []vmclient.Result{
			{
				Metric: map[string]string{"monitor_id": "monitor-a"},
				Values: [][]interface{}{
					{float64(100), "not-a-number"},
					{"bad-timestamp", "100"},
					{float64(120), "NaN"},
					{float64(160), "50"},
				},
			},
		}},
	}

	points := aggregateMonitorSparklines(result, map[string]struct{}{"monitor-a": {}})["monitor-a"]
	if len(points) != 1 {
		t.Fatalf("expected one valid point, got %d", len(points))
	}
	if points[0].Avg != 50 || points[0].Max != 50 {
		t.Fatalf("unexpected valid point: %+v", points[0])
	}
}
