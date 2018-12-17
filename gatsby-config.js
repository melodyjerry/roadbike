require(`dotenv`).config({
  path: `.env.${process.env.NODE_ENV}`,
})

module.exports = {
  siteMetadata: {
    title: `GatsbyJS`,
    siteUrl: `https://www.gatsbyjs.org`,
    description: `Blazing fast modern site generator for React`,
    twitter: `@gatsbyjs`,
  },
  mapping: {
    "MarkdownRemark.frontmatter.author": `AuthorYaml`,
  },
  plugins: [
    {
        resolve: `gatsby-source-filesystem`,
        options: {
            path: `${__dirname}/src/assets`,
            name: 'assets',
        },
    },
    {
        resolve: `gatsby-source-filesystem`,
        options: {
            path: `${__dirname}/src/xsjposts/blogs`,
            name: 'blogs',
        },
    },
    {
        resolve: `gatsby-source-filesystem`,
        options: {
            path: `${__dirname}/src/xsjposts/docs`,
            name: 'docs',
        },
    },
    {
        resolve: `gatsby-source-filesystem`,
        options: {
            path: `${__dirname}/src/xsjposts/logs`,
            name: 'logs',
        },
    },
    `gatsby-transformer-xsjzip`,
    {
      resolve: `gatsby-plugin-typography`,
      options: {
        pathToConfigModule: `src/utils/typography`,
      },
    },
    `gatsby-transformer-yaml`,
    {
      resolve: `gatsby-plugin-nprogress`,
      options: {
        color: `#9D7CBF`,
        showSpinner: false,
      },
    },
    `gatsby-plugin-emotion`,
    `gatsby-transformer-sharp`,
    `gatsby-plugin-sharp`,
    `gatsby-plugin-catch-links`,
    `gatsby-plugin-lodash`,
    {
      resolve: `gatsby-plugin-manifest`,
      options: {
        name: `GatsbyJS`,
        short_name: `GatsbyJS`,
        start_url: `/`,
        background_color: `#ffffff`,
        theme_color: `#663399`,
        display: `minimal-ui`,
        icon: `src/assets/logo-icon.png`,
      },
    },
    `gatsby-plugin-offline`,
    `gatsby-plugin-react-helmet`,
    `gatsby-plugin-sitemap`,
    {
      resolve: `gatsby-plugin-feed`,
      options: {
        feeds: [
          {
            query: `
              {
                allStoryWriterMarkdown(
                  sort: { order: DESC, fields: [createDate] }
                  filter: {
                    docType: {eq: "blogs"}
                  }
                ) {
                  edges {
                    node {
                      excerpt
                      html
                      title
                      createDate
                      updateDate
                      tags
                      slug
                    }
                  }
                }
              }
            `,
            output: `/blog/rss.xml`,
            setup: ({
              query: {
                site: { siteMetadata },
              },
            }) => {
              return {
                title: siteMetadata.title,
                description: siteMetadata.description,
                feed_url: siteMetadata.siteUrl + `/blog/rss.xml`,
                site_url: siteMetadata.siteUrl,
                generator: `GatsbyJS`,
              }
            },
            serialize: ({ query: { site, allStoryWriterMarkdown } }) =>
              allStoryWriterMarkdown.edges.map(({ node }) => {
                return {
                  title: node.title,
                  description: node.excerpt,
                  url: site.siteMetadata.siteUrl + node.slug,
                  guid: site.siteMetadata.siteUrl + node.slug,
                  custom_elements: [{ "content:encoded": node.html }],
                }
              }),
          },
        ],
      },
    },
  ],
}
