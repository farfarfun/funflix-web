#!/usr/bin/env bash
# 本地库路径：web / worker / sync 三个服务共用，避免各写各的漂移。
#
# 路径与 funflix 自身在 funsecret 未配置时的兜底路径一致
# （~/.cache/farfarfun/funflix/funflix.db），这样在这台机器上手动跑
# `funflix` CLI（migrate / sync / db info）不用记额外的环境变量，
# 天然对着同一份本地库。

readonly LOCAL_DATABASE_URL="sqlite+aiosqlite:///${HOME}/.cache/farfarfun/funflix/funflix.db"
