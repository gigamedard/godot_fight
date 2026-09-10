curl -s -o /dev/null -w "%{http_code}\n" -X POST "http://127.0.0.1:8081/apps/123456/events" -d "{\"name\":\"x\",\"channels\":[\"x\"],\"data\":\"{}\"}"
