module github.com/myorg/myapp

go 1.21

require (
  github.com/gin-gonic/gin v1.9.0
  github.com/stretchr/testify v1.8.0 // indirect
  golang.org/x/crypto v0.0.0-20230101-abcdef012345 // indirect
  github.com/fake/nonexistent-hallucinated-pkg v0.0.1
)

replace github.com/old/pkg => github.com/new/pkg v1.0.0
