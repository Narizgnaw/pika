package service

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/dushixiang/pika/internal/protocol"
	"github.com/dushixiang/pika/pkg/agent/collector"
	"github.com/dushixiang/pika/pkg/agent/utils"
	bolt "go.etcd.io/bbolt"
)

const (
	metricsBufferDBName  = "metrics_buffer.db"
	metricsBufferBucket  = "metrics_buffer"
	metricsBufferTimeout = 2 * time.Second
)

type metricsBuffer struct {
	path string
	mu   sync.Mutex
}

func newMetricsBuffer() *metricsBuffer {
	path := filepath.Join(utils.GetSafeHomeDir(), ".pika", metricsBufferDBName)
	return &metricsBuffer{path: path}
}

func (b *metricsBuffer) Append(v interface{}) error {
	payload, err := json.Marshal(v)
	if err != nil {
		return fmt.Errorf("序列化指标缓存失败: %w", err)
	}

	b.mu.Lock()
	defer b.mu.Unlock()

	db, err := b.openDB()
	if err != nil {
		return err
	}
	defer db.Close()

	if err := db.Update(func(tx *bolt.Tx) error {
		bucket, err := tx.CreateBucketIfNotExists([]byte(metricsBufferBucket))
		if err != nil {
			return fmt.Errorf("创建指标缓存桶失败: %w", err)
		}

		seq, err := bucket.NextSequence()
		if err != nil {
			return fmt.Errorf("获取指标缓存序列失败: %w", err)
		}

		key := make([]byte, 8)
		binary.BigEndian.PutUint64(key, seq)
		if err := bucket.Put(key, payload); err != nil {
			return fmt.Errorf("写入指标缓存失败: %w", err)
		}

		return nil
	}); err != nil {
		return err
	}

	return nil
}

func (b *metricsBuffer) Flush(writer collector.WebSocketWriter) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	db, err := b.openDB()
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, err
	}
	defer db.Close()

	var (
		sent    int
		sendErr error
	)

	if err := db.Update(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(metricsBufferBucket))
		if bucket == nil {
			return nil
		}

		cursor := bucket.Cursor()
		for k, v := cursor.First(); k != nil; k, v = cursor.Next() {
			if sendErr != nil {
				break
			}

			var msg protocol.OutboundMessage
			if err := json.Unmarshal(v, &msg); err != nil {
				slog.Warn("缓存指标解析失败，已跳过", "error", err)
				if err := cursor.Delete(); err != nil {
					return fmt.Errorf("删除损坏缓存失败: %w", err)
				}
				continue
			}

			if err := writer.WriteJSON(msg); err != nil {
				sendErr = err
				break
			}

			if err := cursor.Delete(); err != nil {
				return fmt.Errorf("删除已发送缓存失败: %w", err)
			}
			sent++
		}

		return nil
	}); err != nil {
		return sent, err
	}

	if sendErr != nil {
		return sent, sendErr
	}

	return sent, nil
}

func (b *metricsBuffer) openDB() (*bolt.DB, error) {
	if err := os.MkdirAll(filepath.Dir(b.path), 0755); err != nil {
		return nil, fmt.Errorf("创建指标缓存目录失败: %w", err)
	}

	db, err := bolt.Open(b.path, 0600, &bolt.Options{Timeout: metricsBufferTimeout})
	if err != nil {
		return nil, fmt.Errorf("打开指标缓存数据库失败: %w", err)
	}

	return db, nil
}

type metricsWriter struct {
	conn     *safeConn
	buffer   *metricsBuffer
	buffered bool
	sendErr  error
}

func newMetricsWriter(conn *safeConn, buffer *metricsBuffer) *metricsWriter {
	return &metricsWriter{
		conn:   conn,
		buffer: buffer,
	}
}

func (w *metricsWriter) WriteJSON(v interface{}) error {
	if w.conn == nil {
		if err := w.buffer.Append(v); err != nil {
			return err
		}
		w.buffered = true
		return nil
	}

	if err := w.conn.WriteJSON(v); err != nil {
		if bufferErr := w.buffer.Append(v); bufferErr != nil {
			return fmt.Errorf("写入指标缓存失败: %w", bufferErr)
		}
		w.buffered = true
		w.sendErr = err
		return nil
	}

	return nil
}
