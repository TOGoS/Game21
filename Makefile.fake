define generate_targets
TARGETS := $(shell node build.js --list-targets)

.PHONY: $$(TARGETS)

$$(TARGETS):
	node build.js $(MAKECMDGOALS)
endef

$(eval $(call generate_targets))
