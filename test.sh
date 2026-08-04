#!/bin/bash
# ╔══════════════════════════════════════════════════════════╗
# ║   Smart Auto Commit Splitter — Backdated Edition          ║
# ║   Same classification/grouping engine as autoc.sh,        ║
# ║   plus commits spread across a date range you choose.     ║
# ╠══════════════════════════════════════════════════════════╣
#
#  Usage:
#    ./autoc_backdated.sh <num_commits> [start_date] [end_date]
#
#  Examples:
#    ./autoc_backdated.sh 150
#    ./autoc_backdated.sh 150 "2026-08-04" "2026-08-07"
#
#  Defaults: start_date=2026-08-04, end_date=2026-08-07
#
#  Every commit this script makes gets GIT_AUTHOR_DATE and
#  GIT_COMMITTER_DATE set to a timestamp somewhere in
#  [start_date 09:00, end_date <now-or-20:00>], spread out in
#  increasing order across "working hours" on each day so the
#  history reads as incremental work rather than a burst.
#
#  If end_date is today, the window for that day is capped at
#  the current time minus a couple of minutes, so no commit
#  ends up dated in the future.
#
#  Everything else — file classification, semantic scoping,
#  commit-type/message generation, batching — is copied
#  verbatim from autoc.sh so the messages you get are the same
#  quality/style you already had.

if [ -z "$1" ]; then
  echo "❌  Usage: autoc_backdated.sh <num_commits> [start_date YYYY-MM-DD] [end_date YYYY-MM-DD]"
  exit 1
fi

NUM_COMMITS=$1
START_DATE="${2:-2026-08-04}"
END_DATE="${3:-2026-08-07}"

if ! git rev-parse --git-dir &>/dev/null; then
  echo "❌  Not inside a git repository."
  exit 1
fi

# ── Collect files (NUL-separated → newline array) ─────────
mapfile -t FILES < <(git ls-files -z --modified --others --exclude-standard \
                     | tr '\0' '\n')
TOTAL_FILES=${#FILES[@]}

if [ "$TOTAL_FILES" -eq 0 ]; then
  echo "✅  Nothing to commit — working tree is clean."
  exit 0
fi

[ "$TOTAL_FILES" -lt "$NUM_COMMITS" ] && NUM_COMMITS=$TOTAL_FILES
echo "📦  $TOTAL_FILES files detected → planning up to $NUM_COMMITS commits"
echo "🗓️   Backdating across $START_DATE → $END_DATE"
echo ""

# ══════════════════════════════════════════════════════════
#  EXTENSION → lang|domain|type_hint   (identical to autoc.sh)
# ══════════════════════════════════════════════════════════
classify_extension() {
  local f="$1"
  local ext="${f##*.}"
  local base; base="$(basename "$f")"

  case "$base" in
    package.json|package-lock.json|yarn.lock|pnpm-lock.yaml|bun.lockb|shrinkwrap.json)
      echo "js-deps|deps|chore"; return ;;
    requirements*.txt|Pipfile|Pipfile.lock|poetry.lock|setup.py|setup.cfg|pyproject.toml)
      echo "py-deps|deps|chore"; return ;;
    go.sum|go.mod)                      echo "go-deps|deps|chore";    return ;;
    Gemfile|Gemfile.lock)               echo "rb-deps|deps|chore";    return ;;
    Cargo.toml|Cargo.lock)             echo "rust-deps|deps|chore";  return ;;
    composer.json|composer.lock)       echo "php-deps|deps|chore";   return ;;
    Dockerfile|docker-compose*.yml|docker-compose*.yaml)
                                        echo "docker|infra|ci";       return ;;
    Makefile|makefile)                  echo "make|infra|chore";      return ;;
    Procfile)                           echo "heroku|infra|ci";       return ;;
    nginx.conf|*.nginx|.htaccess)       echo "server-config|infra|ci"; return ;;
    jest.config.*|vitest.config.*|karma.conf.*)
                                        echo "test-config|test|config"; return ;;
    babel.config.*|.babelrc*)           echo "babel|tooling|config";  return ;;
    tsconfig*.json|jsconfig*.json)      echo "ts-config|tooling|config"; return ;;
    webpack.config.*|vite.config.*|rollup.config.*|esbuild.config.*)
                                        echo "bundler|tooling|config"; return ;;
    tailwind.config.*|postcss.config.*) echo "css-config|styles|config"; return ;;
    next.config.*|nuxt.config.*|astro.config.*|svelte.config.*)
                                        echo "framework-config|app|config"; return ;;
    .eslintrc*|.eslintignore|.prettierrc*|.stylelintrc*)
                                        echo "linter|tooling|config"; return ;;
    .env|.env.*|*.env)                  echo "env|config|config";     return ;;
    .gitignore|.gitattributes|.editorconfig)
                                        echo "git-config|tooling|chore"; return ;;
    *.test.ts|*.test.tsx|*.test.js|*.test.jsx|*.spec.ts|*.spec.tsx|*.spec.js|*.spec.jsx)
                                        echo "test|test|test";        return ;;
    *.d.ts)                             echo "typescript|types|types"; return ;;
  esac

  case "$ext" in
    tsx)          echo "react|ui|feat"           ;;
    jsx)          echo "react|ui|feat"           ;;
    ts)           echo "typescript|logic|feat"   ;;
    js)           echo "javascript|logic|feat"   ;;
    mjs)          echo "esmodule|logic|chore"    ;;
    cjs)          echo "commonjs|logic|chore"    ;;
    svelte)       echo "svelte|ui|feat"          ;;
    vue)          echo "vue|ui|feat"             ;;
    astro)        echo "astro|ui|feat"           ;;
    css)          echo "css|styles|style"        ;;
    scss|sass)    echo "scss|styles|style"       ;;
    less)         echo "less|styles|style"       ;;
    styl)         echo "stylus|styles|style"     ;;
    mdx)          echo "mdx|content|docs"        ;;
    md)           echo "markdown|docs|docs"      ;;
    txt)          echo "text|docs|docs"          ;;
    html|htm)     echo "html|ui|feat"            ;;
    json)         echo "json|config|config"      ;;
    yaml|yml)     echo "yaml|config|config"      ;;
    toml)         echo "toml|config|config"      ;;
    ini|cfg|conf) echo "config|config|config"    ;;
    xml)          echo "xml|config|config"       ;;
    py)           echo "python|logic|feat"       ;;
    pyi)          echo "python|types|types"      ;;
    ipynb)        echo "notebook|data|feat"      ;;
    csv|tsv)      echo "data|data|chore"         ;;
    parquet|arrow|avro) echo "data|data|chore"   ;;
    sql)          echo "sql|db|feat"             ;;
    prisma)       echo "prisma|db|feat"          ;;
    graphql|gql)  echo "graphql|api|feat"        ;;
    proto)        echo "protobuf|api|feat"        ;;
    sh|bash|zsh)  echo "shell|scripts|chore"     ;;
    ps1)          echo "powershell|scripts|chore" ;;
    go)           echo "go|logic|feat"           ;;
    rb)           echo "ruby|logic|feat"         ;;
    rs)           echo "rust|logic|feat"         ;;
    java)         echo "java|logic|feat"         ;;
    kt)           echo "kotlin|logic|feat"       ;;
    php)          echo "php|logic|feat"          ;;
    cs)           echo "csharp|logic|feat"       ;;
    cpp|cc|cxx)   echo "cpp|logic|feat"          ;;
    c)            echo "c|logic|feat"            ;;
    tf|tfvars)    echo "terraform|infra|ci"      ;;
    png|jpg|jpeg|gif|webp|svg|ico|avif)
                  echo "image|assets|chore"      ;;
    woff|woff2|ttf|otf|eot)
                  echo "font|assets|chore"       ;;
    *)            echo "file|misc|refactor"      ;;
  esac
}

# ══════════════════════════════════════════════════════════
#  PATH SEGMENT → SEMANTIC SCOPE   (identical to autoc.sh)
# ══════════════════════════════════════════════════════════
declare -A SEGMENT_SCOPE=(
  [components]="components"    [component]="components"
  [pages]="pages"              [page]="pages"
  [views]="views"              [view]="views"
  [layouts]="layouts"          [layout]="layouts"
  [screens]="screens"          [screen]="screens"
  [containers]="containers"    [container]="containers"
  [templates]="templates"      [template]="templates"
  [ui]="ui"                    [widgets]="widgets"
  [icons]="icons"              [icon]="icons"
  [utils]="utils"              [util]="utils"
  [helpers]="helpers"          [helper]="helpers"
  [lib]="lib"                  [libs]="lib"
  [common]="common"            [shared]="shared"
  [core]="core"
  [constants]="constants"      [constant]="constants"
  [enums]="constants"          [enum]="constants"
  [store]="store"              [stores]="store"
  [redux]="store"              [state]="store"
  [reducers]="store"           [reducer]="store"
  [actions]="store"            [action]="store"
  [slices]="store"             [slice]="store"
  [selectors]="store"
  [context]="context"          [contexts]="context"
  [providers]="context"        [provider]="context"
  [atoms]="store"              [signals]="store"
  [hooks]="hooks"              [hook]="hooks"
  [composables]="hooks"        [composable]="hooks"
  [directives]="hooks"         [hoc]="hooks"
  [api]="api"                  [apis]="api"
  [routes]="routes"            [route]="routes"
  [router]="routes"            [routers]="routes"
  [controllers]="controllers"  [controller]="controllers"
  [handlers]="handlers"        [handler]="handlers"
  [resolvers]="resolvers"      [resolver]="resolvers"
  [services]="services"        [service]="services"
  [repositories]="repositories" [repository]="repositories"
  [usecases]="usecases"        [usecase]="usecases"
  [interactors]="usecases"
  [middleware]="middleware"    [middlewares]="middleware"
  [guards]="guards"            [guard]="guards"
  [policies]="guards"
  [validators]="validators"    [validator]="validators"
  [serializers]="serializers"  [serializer]="serializers"
  [dto]="dto"                  [dtos]="dto"
  [models]="models"            [model]="models"
  [schemas]="schemas"          [schema]="schemas"
  [entities]="models"          [entity]="models"
  [migrations]="migrations"    [migration]="migrations"
  [seeds]="seeds"              [seeders]="seeds"
  [database]="db"              [db]="db"
  [prisma]="db"                [knex]="db"
  [auth]="auth"                [authentication]="auth"
  [authorization]="auth"       [oauth]="auth"
  [jwt]="auth"                 [session]="auth"
  [crypto]="security"          [encryption]="security"
  [config]="config"            [configs]="config"
  [configuration]="config"     [settings]="config"
  [env]="config"
  [infra]="infra"              [infrastructure]="infra"
  [terraform]="infra"          [k8s]="infra"
  [kubernetes]="infra"         [helm]="infra"
  [docker]="infra"
  [ci]="ci"                    [cd]="ci"
  [scripts]="scripts"          [script]="scripts"
  [bin]="scripts"              [tools]="scripts"
  [workers]="workers"          [worker]="workers"
  [jobs]="workers"             [job]="workers"
  [queues]="workers"           [queue]="workers"
  [tasks]="workers"            [task]="workers"
  [cron]="workers"
  [events]="events"            [event]="events"
  [listeners]="events"         [listener]="events"
  [subscribers]="events"       [emitters]="events"
  [email]="email"              [mail]="email"
  [mailer]="email"             [notifications]="notifications"
  [webhooks]="webhooks"        [webhook]="webhooks"
  [sockets]="sockets"          [socket]="sockets"
  [websockets]="sockets"
  [docs]="docs"                [doc]="docs"
  [documentation]="docs"       [content]="content"
  [blog]="content"             [posts]="content"
  [styles]="styles"            [style]="styles"
  [css]="styles"               [scss]="styles"
  [themes]="styles"            [theme]="styles"
  [tokens]="styles"            [design-system]="styles"
  [assets]="assets"            [asset]="assets"
  [images]="assets"            [image]="assets"
  [fonts]="assets"             [font]="assets"
  [public]="static"            [static]="static"
  [types]="types"              [type]="types"
  [interfaces]="types"         [interface]="types"
  [typings]="types"            [typing]="types"
  [tests]="tests"              [test]="tests"
  [__tests__]="tests"          [spec]="tests"
  [mocks]="tests"              [__mocks__]="tests"
  [fixtures]="tests"           [stubs]="tests"
  [e2e]="tests"                [cypress]="tests"
  [playwright]="tests"
  [data]="data"                [datasets]="data"
  [pipeline]="data"            [pipelines]="data"
  [loaders]="data"
)

GENERIC_SEGMENTS="src app dist build out packages apps"

get_scope() {
  local f="$1"
  local dir; dir=$(dirname "$f")
  [[ "$dir" == "." ]] && { echo "root"; return; }
  dir="${dir#./}"
  IFS='/' read -ra parts <<< "$dir"
  for seg in "${parts[@]}"; do
    local lower="${seg,,}"
    local is_generic=0
    for g in $GENERIC_SEGMENTS; do
      [[ "$lower" == "$g" ]] && is_generic=1 && break
    done
    [[ $is_generic -eq 1 ]] && continue
    if [[ -n "${SEGMENT_SCOPE[$lower]}" ]]; then
      echo "${SEGMENT_SCOPE[$lower]}"; return
    fi
    echo "$lower"; return
  done
  echo "${parts[0],,}"
}

# ══════════════════════════════════════════════════════════
#  DIFF ANALYSIS   (identical to autoc.sh)
# ══════════════════════════════════════════════════════════
get_diff_nature() {
  local f="$1"
  if ! git ls-files --error-unmatch "$f" &>/dev/null 2>&1; then
    echo "new"; return
  fi
  local adds dels
  adds=$(git diff HEAD -- "$f" 2>/dev/null | grep -c '^+[^+]' || true)
  dels=$(git diff HEAD -- "$f" 2>/dev/null | grep -c '^-[^-]' || true)
  adds=${adds:-0}; dels=${dels:-0}
  local total=$((adds + dels))
  if   [ "$total" -eq 0 ];            then echo "new"
  elif [ "$adds" -gt $((dels * 3)) ]; then echo "feat"
  elif [ "$dels" -gt $((adds * 3)) ]; then echo "cleanup"
  elif [ "$adds" -ge "$dels" ];       then echo "enhance"
  else                                     echo "refactor"
  fi
}

# ══════════════════════════════════════════════════════════
#  COMMIT TYPE RESOLUTION   (identical to autoc.sh)
# ══════════════════════════════════════════════════════════
get_commit_type() {
  local f="$1" ext_type_hint="$2" nature="$3"
  case "$f" in
    *.test.*|*.spec.*|*__tests__*|*/__mocks__/*|*/fixtures/*)
      echo "test"; return ;;
    *CHANGELOG*|*CONTRIBUTING*|*README*|*/docs/*|*/doc/*)
      echo "docs"; return ;;
    *.github/*|*/ci/*|*Dockerfile*|*docker-compose*|*Jenkinsfile*|*.gitlab-ci*|*/.circleci/*)
      echo "ci"; return ;;
    */migrations/*)             echo "feat"; return ;;
    *fix*|*bug*|*patch*|*hotfix*) echo "fix"; return ;;
  esac
  case "$ext_type_hint" in
    chore|ci|config|style|docs|test|types) echo "$ext_type_hint"; return ;;
  esac
  case "$nature" in
    new|feat|enhance) echo "feat"     ;;
    cleanup)          echo "chore"    ;;
    *)                echo "refactor" ;;
  esac
}

# ══════════════════════════════════════════════════════════
#  COMMIT MESSAGE GENERATOR   (identical to autoc.sh)
# ══════════════════════════════════════════════════════════
generate_message() {
  local commit_type="$1" scope="$2" dominant_lang="$3"
  shift 3
  local files=("$@")
  local count="${#files[@]}"

  local names=()
  while IFS= read -r n; do names+=("$n"); done < <(
    for f in "${files[@]}"; do
      base="$(basename "$f")"; echo "${base%%.*}"
    done | awk '!seen[$0]++' | grep -v '^$' | head -3
  )

  local n1="${names[0]:-}" n2="${names[1]:-}" n3="${names[2]:-}"
  local name_summary
  if   [[ -z "$n1" ]]; then name_summary="files"
  elif [[ -z "$n2" ]]; then name_summary="$n1"
  elif [[ -z "$n3" ]]; then name_summary="$n1 and $n2"
  else                      name_summary="$n1, $n2 and $n3"
  fi

  local lang_tag=""
  case "$dominant_lang" in
    python) lang_tag=" in Python" ;;
    go)     lang_tag=" in Go"     ;;
    ruby)   lang_tag=" in Ruby"   ;;
    rust)   lang_tag=" in Rust"   ;;
  esac

  local subject
  case "$commit_type" in
    feat)
      case "$scope" in
        components|ui|widgets|screens)
          [[ "$count" -gt 1 ]] && subject="add $name_summary components" \
                                || subject="add $name_summary component" ;;
        pages|views|layouts|templates)   subject="add $name_summary ${scope%s}" ;;
        api|routes|controllers|handlers|resolvers) subject="add $name_summary ${scope%s} endpoint" ;;
        services|repositories|usecases)  subject="implement $name_summary service" ;;
        hooks|composables)               subject="add use${n1^} hook" ;;
        models|schemas)                  subject="define $name_summary schema" ;;
        db|migrations)                   subject="add migration for $name_summary" ;;
        auth)                            subject="implement $name_summary auth flow" ;;
        workers|jobs)                    subject="add $name_summary background job" ;;
        store|context)                   subject="add $name_summary state slice" ;;
        data|pipeline)                   subject="add $name_summary data pipeline${lang_tag}" ;;
        *)                               subject="add $name_summary implementation${lang_tag}" ;;
      esac ;;
    fix)
      case "$scope" in
        api|routes|controllers|handlers) subject="fix $name_summary endpoint response" ;;
        auth)        subject="fix auth flow in $name_summary" ;;
        db|models)   subject="fix $name_summary query logic" ;;
        components|ui) subject="fix rendering issue in $name_summary" ;;
        styles)      subject="fix layout regression in $name_summary" ;;
        *)           subject="fix $name_summary in $scope" ;;
      esac ;;
    refactor)
      case "$scope" in
        utils|helpers|lib|common|shared) subject="refactor $name_summary utilities${lang_tag}" ;;
        store|context)        subject="refactor $name_summary state management" ;;
        services|repositories) subject="refactor $name_summary service layer" ;;
        controllers|handlers)  subject="refactor $name_summary controller logic" ;;
        models|schemas)        subject="refactor $name_summary data model" ;;
        components|ui)         subject="refactor $name_summary component structure" ;;
        *)                     subject="refactor $name_summary module${lang_tag}" ;;
      esac ;;
    chore)
      case "$scope" in
        deps)          subject="update $dominant_lang dependencies" ;;
        assets|static) subject="update $name_summary static assets" ;;
        data)          subject="update $name_summary data files" ;;
        scripts)       subject="update $name_summary scripts" ;;
        *)             subject="clean up $name_summary in $scope" ;;
      esac ;;
    docs)  [[ "$n1" == "README" || "$n1" == "readme" ]] \
             && subject="update README" \
             || subject="update docs for $name_summary" ;;
    test)   subject="add tests for $name_summary" ;;
    style)
      case "$scope" in
        styles|themes|tokens) subject="update $name_summary design tokens and styles" ;;
        components|ui)        subject="update $name_summary component styles" ;;
        *)                    subject="update styles in $name_summary" ;;
      esac ;;
    config)
      case "$scope" in
        tooling) subject="update $n1 tooling config"        ;;
        infra)   subject="update $n1 infrastructure config" ;;
        *)       subject="update $name_summary configuration" ;;
      esac ;;
    ci)    subject="update $name_summary CI/CD pipeline" ;;
    types) subject="add type definitions for $name_summary" ;;
    *)     subject="update $name_summary${lang_tag}" ;;
  esac

  [[ $count -gt 6 ]] && subject="${subject} (${count} files)"
  echo "${commit_type}(${scope}): ${subject}"
}

# ══════════════════════════════════════════════════════════
#  GROUP FILES BY SEMANTIC SCOPE   (identical to autoc.sh)
# ══════════════════════════════════════════════════════════
declare -A group_map   # key → newline-separated file list

for f in "${FILES[@]}"; do
  scope=$(get_scope "$f")
  if [[ -z "${group_map[$scope]}" ]]; then
    group_map["$scope"]="$f"
  else
    group_map["$scope"]+=$'\n'"$f"
  fi
done

mapfile -t group_keys < <(printf '%s\n' "${!group_map[@]}" | sort)
total_groups="${#group_keys[@]}"
echo "📁  $total_groups semantic groups detected: ${group_keys[*]}"
echo ""

read_group() {
  local key="$1"
  local -n _arr="$2"
  mapfile -t _arr <<< "${group_map[$key]}"
  [[ -z "${_arr[-1]}" ]] && unset '_arr[-1]'
}

# ══════════════════════════════════════════════════════════
#  BUILD COMMIT BATCHES   (identical to autoc.sh)
# ══════════════════════════════════════════════════════════
BATCHES=()

if [ "$total_groups" -le "$NUM_COMMITS" ]; then
  commits_left=$NUM_COMMITS
  groups_left=$total_groups

  for key in "${group_keys[@]}"; do
    read_group "$key" group_files
    gcount="${#group_files[@]}"

    alloc=$(( (commits_left + groups_left - 1) / groups_left ))
    [[ $alloc -lt 1 ]] && alloc=1

    if [ "$gcount" -le "$alloc" ] || [ "$alloc" -eq 1 ]; then
      BATCHES+=("$(printf '%s\n' "${group_files[@]}")")
      commits_left=$(( commits_left - 1 ))
    else
      chunk=$(( (gcount + alloc - 1) / alloc ))
      idx=0; used=0
      while [ $idx -lt $gcount ] && [ $used -lt $alloc ]; do
        slice=("${group_files[@]:$idx:$chunk}")
        BATCHES+=("$(printf '%s\n' "${slice[@]}")")
        commits_left=$(( commits_left - 1 ))
        idx=$(( idx + chunk ))
        used=$(( used + 1 ))
      done
    fi
    groups_left=$(( groups_left - 1 ))
  done

else
  per=$(( (TOTAL_FILES + NUM_COMMITS - 1) / NUM_COMMITS ))
  buf=()
  for key in "${group_keys[@]}"; do
    read_group "$key" gf
    buf+=("${gf[@]}")
    if [ "${#buf[@]}" -ge "$per" ]; then
      BATCHES+=("$(printf '%s\n' "${buf[@]}")")
      buf=()
    fi
  done
  [[ "${#buf[@]}" -gt 0 ]] && BATCHES+=("$(printf '%s\n' "${buf[@]}")")
fi

TOTAL_BATCHES="${#BATCHES[@]}"

# ══════════════════════════════════════════════════════════
#  NEW: build one increasing timestamp per batch, spread
#  across [START_DATE 09:00 .. END_DATE <cap>], business
#  hours only (09:00–20:00), with random jitter so it doesn't
#  look mechanically even.
# ══════════════════════════════════════════════════════════
build_timestamps() {
  local n="$1"
  local start_epoch end_epoch now_epoch today
  start_epoch=$(date -d "${START_DATE} 09:00:00" +%s)
  end_epoch=$(date -d "${END_DATE} 20:00:00" +%s)
  now_epoch=$(date +%s)
  today=$(date +%Y-%m-%d)

  # If the end date is today, don't let timestamps run past "now".
  if [ "$END_DATE" == "$today" ]; then
    local cap=$(( now_epoch - 120 ))
    [ "$cap" -lt "$end_epoch" ] && end_epoch=$cap
  fi

  if [ "$end_epoch" -le "$start_epoch" ]; then
    echo "❌  End date/time resolves before start date/time — adjust START_DATE/END_DATE." >&2
    exit 1
  fi

  # Enumerate each day in range, build a 09:00-20:00 window per day
  # (clamped by start_epoch/end_epoch), weighted so later days get
  # a slightly bigger share (mimics a build ramping up).
  local -a day_list=()
  local cur="$START_DATE"
  while [ "$(date -d "$cur" +%s)" -le "$(date -d "$END_DATE" +%s)" ]; do
    day_list+=("$cur")
    cur=$(date -d "$cur + 1 day" +%Y-%m-%d)
  done
  local num_days="${#day_list[@]}"

  # Simple weighting: earliest day gets the smallest share, ramps up.
  local -a weights=()
  local wsum=0
  for ((i=0; i<num_days; i++)); do
    local w=$(( i + 3 ))   # 3,4,5,6...
    weights+=("$w")
    wsum=$(( wsum + w ))
  done

  local assigned=0
  local -a per_day_count=()
  for ((i=0; i<num_days; i++)); do
    local c=$(( n * ${weights[$i]} / wsum ))
    per_day_count+=("$c")
    assigned=$(( assigned + c ))
  done
  # Dump any rounding remainder onto the last day
  local remainder=$(( n - assigned ))
  per_day_count[$((num_days-1))]=$(( per_day_count[$((num_days-1))] + remainder ))

  TIMESTAMPS=()
  for ((i=0; i<num_days; i++)); do
    local d="${day_list[$i]}"
    local dcount="${per_day_count[$i]}"
    [ "$dcount" -le 0 ] && continue

    local dstart=$(date -d "$d 09:00:00" +%s)
    local dend=$(date -d "$d 20:00:00" +%s)
    [ "$dstart" -lt "$start_epoch" ] && dstart=$start_epoch
    [ "$dend" -gt "$end_epoch" ] && dend=$end_epoch
    [ "$dend" -le "$dstart" ] && continue

    local span=$(( dend - dstart ))
    local -a offsets=()
    for ((j=0; j<dcount; j++)); do
      offsets+=( $(( RANDOM % span )) )
    done
    # sort offsets so timestamps increase within the day
    mapfile -t offsets < <(printf '%s\n' "${offsets[@]}" | sort -n)

    for off in "${offsets[@]}"; do
      TIMESTAMPS+=( $(( dstart + off )) )
    done
  done

  # Safety: if rounding left us short, pad with the last day's end time
  while [ "${#TIMESTAMPS[@]}" -lt "$n" ]; do
    TIMESTAMPS+=("$end_epoch")
  done
}

build_timestamps "$TOTAL_BATCHES"

echo "🗓️   ${#TIMESTAMPS[@]} timestamps generated for $START_DATE → $END_DATE"
echo ""

# ══════════════════════════════════════════════════════════
#  COMMIT LOOP — same classification as autoc.sh, but each
#  commit gets GIT_AUTHOR_DATE / GIT_COMMITTER_DATE from the
#  precomputed timestamp list, in order.
# ══════════════════════════════════════════════════════════
commit_count=0
ts_index=0

for batch in "${BATCHES[@]}"; do
  mapfile -t batch_files <<< "$batch"
  [[ -z "${batch_files[-1]}" ]] && unset 'batch_files[-1]'
  [[ "${#batch_files[@]}" -eq 0 ]] && continue

  git add -- "${batch_files[@]}"

  staged=$(git diff --cached --name-only 2>/dev/null)
  [[ -z "$staged" ]] && continue

  declare -A type_count scope_count lang_count domain_count

  for f in "${batch_files[@]}"; do
    IFS='|' read -r lang domain ext_hint <<< "$(classify_extension "$f")"
    nature=$(get_diff_nature "$f")
    t=$(get_commit_type "$f" "$ext_hint" "$nature")
    s=$(get_scope "$f")
    (( type_count[$t]++        )) || true
    (( scope_count[$s]++       )) || true
    (( lang_count[$lang]++     )) || true
    (( domain_count[$domain]++ )) || true
  done

  commit_type=$(for k in "${!type_count[@]}";  do echo "${type_count[$k]}  $k"; done \
    | sort -nr | head -1 | awk '{print $2}')
  commit_scope=$(for k in "${!scope_count[@]}"; do echo "${scope_count[$k]} $k"; done \
    | sort -nr | head -1 | awk '{print $2}')
  dominant_lang=$(for k in "${!lang_count[@]}"; do echo "${lang_count[$k]} $k"; done \
    | sort -nr | head -1 | awk '{print $2}')

  [[ -z "$commit_scope" ]]  && commit_scope="misc"
  [[ -z "$dominant_lang" ]] && dominant_lang="code"

  message=$(generate_message \
    "$commit_type" "$commit_scope" "$dominant_lang" "${batch_files[@]}")

  epoch="${TIMESTAMPS[$ts_index]}"
  iso_date=$(date -d "@$epoch" +"%Y-%m-%dT%H:%M:%S%z")

  GIT_AUTHOR_DATE="$iso_date" GIT_COMMITTER_DATE="$iso_date" \
    git commit -m "$message" --quiet

  echo "  ✅  [$((commit_count + 1))/$TOTAL_BATCHES]  ($iso_date)  $message"
  commit_count=$(( commit_count + 1 ))
  ts_index=$(( ts_index + 1 ))

  unset type_count scope_count lang_count domain_count
done

echo ""
echo "🎉  Done — $commit_count commits created, dated $START_DATE → $END_DATE."
echo "    Review with: git log --format='%h %ad %s' --date=iso"