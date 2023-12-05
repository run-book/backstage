# Why use pom.xml/package/json as the source of truth?

It already has a huge amount of the data already. For example name/version/description/dependencies.

we could duplicate this data by copying it. But then we have to keep it in sync.

# Why use 'backstage.xxx' properties

The maven pom.xml is not very extensible. But it does have a properties section. We can use this to add extra data to the pom.xml.

For example 
* we can add 'backstage.kind' that allows us to define what kind of component this is.
* We can add 'backstage.ignore' to ignore a component. For example just test libraries

# backstage.xxx.yaml files
Sometimes a module will define multiple things:
* A service
* An API
* A library

It might be possible to tweak the pom.xml to define multiple things. But this would be messy and not clear.
So we can use the pom.xml to define the main thing. And then use a backstage.xxx.yaml file to define the other things.

# What do we do if we have package.json and pom.xml in the directory?

For now...nothing. We'll do a chain of responsibility. So we'll look for a pom.xml first. If we don't find one we'll
look for a package.json.

We should really have a three way chain: pom for a single jar, pom with modules, package.json...but that's for later.