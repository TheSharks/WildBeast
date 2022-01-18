---
description: Using systemd, run WildBeast as a service for automatic (re)starting
---

# Running as a service

{% hint style="info" %}
**Good to know:** This guide uses `systemd`, we're assuming this is present on your system.

If you're using Ubuntu 20.04, you're already using `systemd`.
{% endhint %}

## Making a new service

Start creating a new service:

```
sudo nano /etc/systemd/system/wildbeast.service
```

Copy and paste the following example:

```ini
[Unit]
After=network.target network-online.target
Requires=network.target network-online.target
StartLimitBurst=3
StartLimitIntervalSec=0

[Service]
WorkingDirectory=/REPLACE THIS
Type=simple
Restart=on-failure
RestartSec=1
User=REPLACE THIS
ExecStart=/usr/bin/env npm start

[Install]
WantedBy=multi-user.target
```

{% hint style="warning" %}
Pay attention to the `REPLACE THIS`, as you might've guessed you need to replace these values.

*   `WorkingDirectory` - The folder where you saved WildBeast

    For example: `/home/wildbeast/WildBeast`
*   `User` - The user that's going to run WildBeast

    Do **NOT** use `root`, [create a new user](https://www.digitalocean.com/community/tutorials/how-to-create-a-new-sudo-enabled-user-on-ubuntu-20-04-quickstart) for safety.
{% endhint %}

## Controlling the service

### Starting

```
sudo systemctl start wildbeast.service
```

### Stopping

```
sudo systemctl stop wildbeast.service
```

### Start on boot

```
sudo systemctl enable wildbeast.service
```

To undo:

```
sudo systemctl disable wildbeast.service
```

### Restarting

```
sudo systemctl restart wildbeast.service
```
