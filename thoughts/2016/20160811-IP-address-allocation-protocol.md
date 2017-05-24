Routes may be

- Statically configured
  - This includes the default route
- Dynamically allocated

Can use DHCPv6 to allocate addresses

RFC 3315 describes DHCP for IPv6: https://tools.ietf.org/pdf/rfc3315.pdf
RFC 3633 describes prefix delegation options: https://tools.ietf.org/pdf/rfc3633.pdf
(Use OPTION_IAPREFIX in request, i.e. option #26)

Link-local DHCP server: ff02::1:2

