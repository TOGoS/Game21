- Check out Game21 project into some directory somewhere
- Edit .env to set network addresses that will be routed to your machine

As root

- Install node, npm, make, tun2udp
- ```sysctl net.ipv6.conf.all.forwarding=1```
- Also edit ```/etc/sysctl.conf``` to change that setting permanently.
- Create a startup script (maybe just add to ```/etc/rc.local```:
  ```
  cd /path/to/Game21
  ./runtun >tun2udp.log 2>&1 &
  echo "$!" >tun2udp.pid
  ```
  - ```runtun``` will run tun2udp and set up routes as needed

- Also add a startup script to start the router in non-interactive mode, I guess.
  - Which doesn't yet exist.