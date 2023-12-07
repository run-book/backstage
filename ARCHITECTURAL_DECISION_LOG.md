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

# Filetypes

OK we want to point at a repo or monorepo. We want to spider it. And we know that there are many types of files there that
hold structural data about components. We are majoring on
* pom.xml
* package.json

There are others and we want it to be easy to add them, so we will use filetypes. A strategy pattern

Now we know the following:
* For both package.json (workspaces) and pom.xml (modules) we can have multiple components with a parent/child relationship
* It can potentially be a tree of components
* The components are the leaf but data is aggregated as we go through the tree.

Interestingly both package.json and pom.xml have a parent/child relationship. But they are different.
So we have the idea of an 'ArrayHelper' generic that captures the way they can find their parents.

# Filenames
We want the location files to be the primary ones. So they are called 'catalog-info.yaml'. But we also want to be able to
have project files pointed by the location files we call those catalog.xxx.yaml. xxx is typically maven or npm.

Because we often want hard coded yaml files (a component might be a library a service and declare an API) 
we allow backstage.xxx.yml, where xxx is the type of the component.

# What if two entities have the same path

Handled now by the catalog-info.xxx.yaml

# How do we handle annotations and tags?

## Tags
For example we hardcode at the moment the tags 'npm', 'java', 'maven'. 
but we want to be able to add more tags that are defined in pom.xml or package.json.

We can do this by adding a 'backstage.tags' property to the pom.xml or package.json. This will be a comma separated lists of tags

## Annotations


### Documentation annotation
OK there are some special cases. Like the documentation annotation. 
It wouldn't be suprising if we wanted to add more of these special cases....
```yaml
  annotations:
    backstage.io/techdocs-ref: dir:./docs
```
To get this we'll do 'backstage.techdocs' in the pom or package.json. This will be a path to the root of the documentation.
If it exists this will be added to the annotations.

Why do this instead of just the 'other annotations' below? Because it's more expressive and easier for other tools to understand.

### Other annotations
Specified in the pom or package.json. We'll go with comma separated lists again. Like tags.
```xml
<properties>
    <backstage.annotations>key1: value1, key2: value2</backstage.annotations>
</properties>
```

So that means we need to add in the documentation annotation to the other annotations. 
