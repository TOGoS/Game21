## How to simulate power and fluid distribution networks?

Questions:
Can electrical power usage be treated similarly to fluid or item usage?
Do we care about 'pressure'?

Let's say entity wants to do a thing that requires X power during some tick.
- If network topology has changed, recalculate extents of networks
- All power being pulled from and pushed into system is summed
- It

Seems like that technique coule be applied to fluid usage, too.
Potential difference being that fluid might only transfer one square at a time,
whereas power should transfer instantaneously.
