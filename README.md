# Leto Modelizer (leto-modelizer)

[--> README original ici <--](https://github.com/ditrit/leto-modelizer)

* Git Subtree pour `githubator`

[tuto](https://www.atlassian.com/git/tutorials/git-subtree)
```shell
# setup
git remote add -f githubator-plugin https://github.com/ditrit/githubator-plugin
git subtree add --prefix lib/githubator-plugin githubator-plugin main --squash
# pull
git fetch githubator-plugin main
git subtree pull --prefix lib/githubator-plugin githubator-plugin main --squash
```
