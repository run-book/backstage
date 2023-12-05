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

# Typeclass approach

OK we want to point at a repo or monorepo. We want to spider it. And we know that there are many types of files there that
hold structural data about components. We are majoring on
* pom.xml
* package.json

There are others and we want it to be easy to add them, so we will use typeclasses.

Now we know the following:
* For both package.json (workspaces) and pom.xml (modules) we can have multiple components with a parent/child relationship
* It can potentially be a tree of components
* The components are the leaf but data is aggregated as we go through the tree.

But backstage to the rescue.
* We know that we the idea of the entity name. 
* In the case of a pom.xml we can use the groupId/artifactId. 
* In the case of a package.json we can use the name.
* The pom.xml has a parent. So it's easy to know if we have that already loaded.
* The package.json might have workspaces. But it is not so obvious to see the parent child relatioship
  * However workspaces must be under... so we can use the path and just assume the relatioship
  * Later we can do proper matching

Summary
* Scan for files that match the typeclass criteria
  * Gather the filename
  * Gather raw metadata from the file. i.e. don't worry about parents yet
    * This includes the path 
    * This includes the name
      * Note that package.json workspaces don't have a name...
* Partition by type
* For each type
  * A map from path to metadata
  * A map from name to metadata
  * For each metadata of that type
    * Turn it into an array of metadata
    * The parents first, the file itself last
      * parents are found from the two maps
    * We can turn this array into a tree easily enough
    * And we can turn the array into a dictionary easily enough
  * From the tree we can decide the location files
    * Anything that is a parent will get a location file of name `catalog-info.yaml`
* We can now smash this array into a dictionary useful for a template.
  * Note that options coming in from the command line can be added to the dictionary
  * I am not sure the default logic around this...

# What if two entities have the same path

So for example there is a package.json and a pom.xml in the same directory. 

Well we really care about the catalog name with is `<path>/catalog-info.yaml` 
so we just need to check that these are unique

Therefore files need to be able to override this. 






