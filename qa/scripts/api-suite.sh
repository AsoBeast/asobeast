#!/usr/bin/env bash
# Full API regression suite. Prints one line per case: RESULT  TC-ID  title :: observed
# Run from the repo root with the stack up and qa/ids.env populated.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
source qa/ids.env
API=${API:-http://127.0.0.1:4000}
OWNER="qa/evidence/run2-owner.cookies"
OTHER="qa/evidence/run2-other.cookies"
PASS=0; FAIL=0; BLOCK=0
declare -a FAILED=()

# req <method> <url> [curl args...] -> sets $CODE and $BODY
req() {
  local m="$1" u="$2"; shift 2
  BODY=$(curl -s -o /tmp/qa_body -w '%{http_code}' -X "$m" "$u" "$@")
  CODE="$BODY"
  BODY=$(cat /tmp/qa_body)
}
ck() { # ck <TC> <title> <condition-result 0/1> <observed>
  local tc="$1" title="$2" ok="$3" obs="$4"
  if [ "$ok" = "0" ]; then PASS=$((PASS+1)); printf 'PASS   %-18s %s\n' "$tc" "$title"
  else FAIL=$((FAIL+1)); FAILED+=("$tc"); printf 'FAIL   %-18s %s :: %s\n' "$tc" "$title" "$obs"; fi
}
blocked() { BLOCK=$((BLOCK+1)); printf 'BLOCK  %-18s %s :: %s\n' "$1" "$2" "$3"; }
# expect an exact status code
exp() { # exp <TC> <title> <expected-code> <method> <url> [args...]
  local tc="$1" title="$2" want="$3" m="$4" u="$5"; shift 5
  req "$m" "$u" "$@"
  [ "$CODE" = "$want" ]; ck "$tc" "$title" $? "want $want got $CODE body=$(echo "$BODY" | head -c 150)"
}
# expect the body to match a regex
expbody() { # expbody <TC> <title> <regex> <method> <url> [args...]
  local tc="$1" title="$2" re="$3" m="$4" u="$5"; shift 5
  req "$m" "$u" "$@"
  echo "$BODY" | grep -qE "$re"; ck "$tc" "$title" $? "code=$CODE body=$(echo "$BODY" | head -c 200)"
}
J='content-type: application/json'
O=(-b "$OWNER"); B=(-b "$OTHER")

echo "############ AUTH ############"
exp AUTH-007 "registration closed after owner" 403 POST "$API/auth/register" -H "$J" -d '{"email":"x@y.com","password":"password1234"}'
exp AUTH-008 "login happy path" 200 POST "$API/auth/login" -H "$J" -d '{"email":"qa-owner@asobeast.test","password":"QaOwnerPass123!"}'
exp AUTH-009 "login wrong password" 401 POST "$API/auth/login" -H "$J" -d '{"email":"qa-owner@asobeast.test","password":"wrongwrongwrong"}'
exp AUTH-010 "no user enumeration" 401 POST "$API/auth/login" -H "$J" -d '{"email":"nobody@nowhere.test","password":"wrongwrongwrong"}'
exp AUTH-011 "email case insensitive" 200 POST "$API/auth/login" -H "$J" -d '{"email":"QA-OWNER@ASOBEAST.TEST","password":"QaOwnerPass123!"}'
exp AUTH-012 "/auth/me anonymous" 401 GET "$API/auth/me"
exp AUTH-013 "/auth/me forged cookie" 401 GET "$API/auth/me" -H 'Cookie: asobeast_session=garbage.token.here'
exp AUTH-014 "/auth/me authenticated" 200 GET "$API/auth/me" "${O[@]}"
exp AUTH-015 "/auth/plan" 200 GET "$API/auth/plan" "${O[@]}"

echo "############ APP IMPORT ############"
exp APP-002 "import empty url" 400 POST "$API/apps" "${O[@]}" -H "$J" -d '{"url":""}'
exp APP-003 "import free text" 400 POST "$API/apps" "${O[@]}" -H "$J" -d '{"url":"not a url at all"}'
exp APP-004 "import non-store url" 400 POST "$API/apps" "${O[@]}" -H "$J" -d '{"url":"https://example.com/foo"}'
exp APP-005 "import bad country" 400 POST "$API/apps" "${O[@]}" -H "$J" -d '{"url":"https://apps.apple.com/us/app/x/id123456789","country":"XXXXX"}'
exp APP-006 "import loopback SSRF" 400 POST "$API/apps" "${O[@]}" -H "$J" -d '{"url":"http://127.0.0.1:4000/health"}'
exp APP-007 "import file:// scheme" 400 POST "$API/apps" "${O[@]}" -H "$J" -d '{"url":"file:///etc/passwd"}'
exp APP-008 "unknown app id 404" 404 GET "$API/apps/does-not-exist" "${O[@]}"
expbody APP-009 "SQLi payload inert" 'not found' GET "$API/apps/%27%3B%20DROP%20TABLE%20apps%3B--" "${O[@]}"

echo "############ READ SURFACES ############"
for pair in "READ-002:/apps/$PRIMARY" "READ-003:/apps/$PRIMARY/summary" "READ-004:/apps/$PRIMARY/keywords" \
  "READ-005:/apps/$PRIMARY/rankings" "READ-006:/apps/$PRIMARY/reviews" "READ-007:/apps/$PRIMARY/reviews/histogram" \
  "READ-008:/apps/$PRIMARY/changes" "READ-009:/apps/$PRIMARY/competitors" "READ-010:/apps/$PRIMARY/competitors/analysis" \
  "READ-011:/apps/$PRIMARY/audit" "READ-012:/apps/$PRIMARY/metadata/audit" "READ-013:/apps/$PRIMARY/category-ranks" \
  "READ-014:/apps/$PRIMARY/visibility-history" "READ-015:/apps/$PRIMARY/ratings-history" "READ-016:/actions" \
  "READ-017:/portfolio" "READ-018:/keywords/$KW_TREND/serp" "READ-019:/jobs/budget" "READ-020:/changes/recent" \
  "READ-021:/apps/$PRIMARY/audit/history" "READ-022:/apps/$PRIMARY/serp-movers" "READ-023:/apps/$PRIMARY/rank-distribution-history" \
  "READ-024:/apps/$PRIMARY/keyword-countries" "READ-025:/apps/$PRIMARY/keyword-field" "READ-026:/apps/$PRIMARY/keywords/compare" \
  "READ-027:/apps/$UNICODE" "READ-028:/apps/$UNICODE/keywords" "READ-029:/actions/summary" "READ-030:/actions/ai-status" \
  "READ-031:/metadata/assistant" "READ-032:/alerts/deliveries" "READ-033:/jobs/store-health" "READ-034:/jobs/run-status"; do
  tc="${pair%%:*}"; path="${pair#*:}"
  exp "$tc" "GET $path" 200 GET "$API$path" "${O[@]}"
done

echo "############ AUTHZ cross-tenant ############"
n=0
for path in "/apps/$PRIMARY" "/apps/$PRIMARY/keywords" "/apps/$PRIMARY/rankings" "/apps/$PRIMARY/reviews" \
  "/apps/$PRIMARY/changes" "/apps/$PRIMARY/competitors" "/apps/$PRIMARY/audit" "/apps/$PRIMARY/metadata/audit" \
  "/apps/$PRIMARY/summary" "/apps/$PRIMARY/category-ranks" "/apps/$PRIMARY/visibility-history" \
  "/apps/$PRIMARY/ratings-history" "/apps/$PRIMARY/keyword-countries" "/apps/$PRIMARY/keyword-field" \
  "/apps/$PRIMARY/audit/history" "/apps/$PRIMARY/serp-movers" "/apps/$PRIMARY/rank-distribution-history" \
  "/keywords/$KW_TREND/serp"; do
  n=$((n+1)); exp "$(printf 'AUTHZ-%03d' $n)" "tenant B blocked from $path" 404 GET "$API$path" "${B[@]}"
done
exp AUTHZ-019 "tenant B cannot delete tenant A app" 404 DELETE "$API/apps/$PRIMARY" "${B[@]}"
req GET "$API/apps" "${B[@]}"
echo "$BODY" | grep -q 'GeoGuess'; [ $? -ne 0 ]; ck AUTHZ-020 "tenant B app list has no tenant A data" $? "body=$(echo "$BODY" | head -c 150)"
req GET "$API/account/export" "${B[@]}"
echo "$BODY" | grep -q 'GeoGuess'; [ $? -ne 0 ]; ck AUTHZ-021 "tenant B export has no tenant A data" $? "leak detected"
req GET "$API/account/export" "${O[@]}"
echo "$BODY" | grep -qE 'passwordHash|AUTH_SECRET'; [ $? -ne 0 ]; ck AUTHZ-022 "owner export carries no secrets" $? "secret found in export"
exp AUTHZ-023 "anonymous export refused" 401 GET "$API/account/export"

echo "############ KEYWORDS ############"
exp KW-001 "empty array" 400 POST "$API/apps/$PRIMARY/keywords" "${O[@]}" -H "$J" -d '{"keywords":[]}'
exp KW-002 "empty string" 400 POST "$API/apps/$PRIMARY/keywords" "${O[@]}" -H "$J" -d '{"keywords":[""]}'
exp KW-003 "whitespace only" 400 POST "$API/apps/$PRIMARY/keywords" "${O[@]}" -H "$J" -d '{"keywords":["     "]}'
exp KW-005 "wrong type number" 400 POST "$API/apps/$PRIMARY/keywords" "${O[@]}" -H "$J" -d '{"keywords":[123]}'
exp KW-007 "null in array" 400 POST "$API/apps/$PRIMARY/keywords" "${O[@]}" -H "$J" -d '{"keywords":[null]}'
exp KW-009 "invalid country" 400 POST "$API/apps/$PRIMARY/keywords" "${O[@]}" -H "$J" -d '{"keywords":["valid one"],"country":"USA"}'
exp KW-010 "10k char paste" 400 POST "$API/apps/$PRIMARY/keywords" "${O[@]}" -H "$J" -d "{\"keywords\":[\"$(head -c 10000 < /dev/zero | tr '\0' 'z')\"]}"
exp KW-016a "exactly 100 chars accepted" 201 POST "$API/apps/$PRIMARY/keywords" "${O[@]}" -H "$J" -d "{\"keywords\":[\"$(head -c 100 < /dev/zero | tr '\0' 'q')\"]}"
exp KW-016b "101 chars refused" 400 POST "$API/apps/$PRIMARY/keywords" "${O[@]}" -H "$J" -d "{\"keywords\":[\"$(head -c 101 < /dev/zero | tr '\0' 'r')\"]}"
exp KW-015a "polish diacritics" 201 POST "$API/apps/$PRIMARY/keywords" "${O[@]}" -H "$J" -d '{"keywords":["zażółć gęślą"]}'
exp KW-015b "japanese" 201 POST "$API/apps/$PRIMARY/keywords" "${O[@]}" -H "$J" -d '{"keywords":["日本語 キーワード"]}'
exp KW-015d "emoji" 201 POST "$API/apps/$PRIMARY/keywords" "${O[@]}" -H "$J" -d '{"keywords":["🎮 game"]}'
exp KW-015e "arabic RTL" 201 POST "$API/apps/$PRIMARY/keywords" "${O[@]}" -H "$J" -d '{"keywords":["لعبة الجغرافيا"]}'
exp KW-008 "201 items over cap" 400 POST "$API/apps/$PRIMARY/keywords" "${O[@]}" -H "$J" -d "{\"keywords\":[$(seq 1 201 | sed 's/.*/"limit kw &"/' | paste -sd, -)]}"

echo "############ QUERY PARAMS ############"
exp Q-002 "invalid date" 400 GET "$API/apps/$PRIMARY/rankings?from=not-a-date" "${O[@]}"
exp Q-003 "unknown param days=0" 400 GET "$API/apps/$PRIMARY/rankings?days=0" "${O[@]}"
exp Q-006 "unknown param days=1e9" 400 GET "$API/apps/$PRIMARY/rankings?days=1e9" "${O[@]}"
exp Q-008 "invalid sort" 400 GET "$API/apps/$PRIMARY/keywords?sort=DROP+TABLE" "${O[@]}"
exp Q-009 "valid sort" 200 GET "$API/apps/$PRIMARY/keywords?sort=position" "${O[@]}"
exp Q-010 "review score out of range" 400 GET "$API/apps/$PRIMARY/reviews?score=99" "${O[@]}"
exp Q-011 "review limit -1" 400 GET "$API/apps/$PRIMARY/reviews?limit=-1" "${O[@]}"
exp Q-012 "review limit 1000000" 400 GET "$API/apps/$PRIMARY/reviews?limit=1000000" "${O[@]}"

echo "############ WEBHOOKS SSRF ############"
exp WH-001 "loopback refused" 400 POST "$API/webhooks" "${O[@]}" -H "$J" -d '{"url":"http://127.0.0.1:4000/health","events":["rank.dropped"]}'
exp WH-002 "cloud metadata refused" 400 POST "$API/webhooks" "${O[@]}" -H "$J" -d '{"url":"http://169.254.169.254/latest/meta-data/","events":["rank.dropped"]}'
exp WH-003 "10.x refused" 400 POST "$API/webhooks" "${O[@]}" -H "$J" -d '{"url":"http://10.0.0.5/hook","events":["rank.dropped"]}'
exp WH-004 "192.168.x refused" 400 POST "$API/webhooks" "${O[@]}" -H "$J" -d '{"url":"https://192.168.1.10/hook","events":["rank.dropped"]}'
exp WH-005 "file scheme refused" 400 POST "$API/webhooks" "${O[@]}" -H "$J" -d '{"url":"file:///etc/passwd","events":["rank.dropped"]}'
exp WH-006 "unknown event refused" 400 POST "$API/webhooks" "${O[@]}" -H "$J" -d '{"url":"https://example.com/h","events":["not.real"]}'
exp WH-007 "valid public https" 201 POST "$API/webhooks" "${O[@]}" -H "$J" -d '{"url":"https://example.com/hook","events":["rank.dropped","review.negative"]}'
exp WH-008 "IPv6 loopback refused" 400 POST "$API/webhooks" "${O[@]}" -H "$J" -d '{"url":"http://[::1]:4000/hook","events":["rank.dropped"]}'
exp WH-009 "169.254 link-local refused" 400 POST "$API/webhooks" "${O[@]}" -H "$J" -d '{"url":"http://169.254.1.1/hook","events":["rank.dropped"]}'

echo
echo "==== API SUITE: pass=$PASS fail=$FAIL blocked=$BLOCK ===="
[ ${#FAILED[@]} -gt 0 ] && echo "failed: ${FAILED[*]}"
exit 0
