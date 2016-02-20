Vagrant.configure(2) do |config|
  config.vm.box = "ubuntu/trusty64"
  config.vm.provision "shell", inline: <<-SHELL
    sudo add-apt-repository ppa:mc3man/trusty-media
    curl -sL https://deb.nodesource.com/setup_5.x | sudo -E bash -
    sudo apt-get install -y nodejs
    sudo apt-get install -y ffmpeg
    sudo apt-get install -y build-essential
    sudo apt-get install -y git
    npm install pm2
    npm install
    pm2 install pm2-auto-pull
    pm2 start DougBot.js --name="WildBeast"
  SHELL
end
