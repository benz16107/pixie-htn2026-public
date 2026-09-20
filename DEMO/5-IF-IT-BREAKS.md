# Recovery

| Failure | Action | Accurate wording |
| --- | --- | --- |
| Live agent run is slow | Stop and select replay | "I am switching to the recorded run so we can inspect the same event contract." |
| Elastic is unavailable | Continue with the [memory] result | "The local implementation answered this request; this screen is not a live Elastic result." |
| Phone cannot reach the API | Check EXPO_PUBLIC_API_URL, then use the labelled bundled Auto or driving result | "The phone lost the shared service, so this screen is using the matching bundled demo model." |
| Widget or Live Activity is unavailable | Use the foreground drive-context screen | "This is Expo Go or web. The native extension requires the development build." |
| Recovery PDF sharing is unavailable | Stop on the ready plan | "Pixie built the local recovery record, but this device could not open its share sheet." |
| Sentry console is unavailable | Show the traced fields in code and the API response | "The instrumentation is in the build; the provider console is unavailable." |
| Guideline state is unexpected | Use the reset control and return to case 138 | "I am restoring the prepared rule set." |
| Web page looks stale | Rebuild and restart the production server | "The server was serving an older production bundle." |

Quick checks:

~~~bash
curl -fsS http://localhost:8000/health
curl -fsS http://localhost:3100/queue >/dev/null
cd api && SENTRY_DSN_API= uv run pytest -q
~~~

Never turn an unavailable provider into a claim that cached or local output came from that provider.
