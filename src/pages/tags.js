import React from "react"
import PropTypes from "prop-types"
import { graphql } from "gatsby"

// Utilities
import kebabCase from "lodash/kebabCase"

// Components
import Helmet from "react-helmet"
import { Link } from "gatsby"
import Container from "../components/container"

const TagsPage = ({
  data: {
    allStoryWriterMarkdown: { group },
    site: {
      siteMetadata: { title, description, siteUrl }
    }
  },
  location,
}) => {
  const uniqGroup = group.reduce((lookup, tag) => {
    const key = kebabCase(tag.fieldValue.toLowerCase())
    if (!lookup[key]) {
      lookup[key] = Object.assign(tag, {
        slug: `/tags/${key}`,
      })
    }
    return lookup
  }, {})

  return (
    <Container>
      <Helmet title="Tags" />
      <div>
        <h1>Tags</h1>
        <ul>
          {Object.keys(uniqGroup)
            .sort((tagA, tagB) => tagA.localeCompare(tagB))
            .map(key => {
              const tag = uniqGroup[key]
              return (
                <li key={tag.fieldValue}>
                  <Link to={tag.slug}>
                    {tag.fieldValue} ({tag.totalCount})
                  </Link>
                </li>
              )
            })}
        </ul>
      </div>
    </Container>
  )
}

TagsPage.propTypes = {
  data: PropTypes.shape({
    allStoryWriterMarkdown: PropTypes.shape({
      group: PropTypes.arrayOf(
        PropTypes.shape({
          fieldValue: PropTypes.string.isRequired,
          totalCount: PropTypes.number.isRequired,
        }).isRequired
      ),
    }),
  }),
}

export default TagsPage

export const pageQuery = graphql`
  query {
    site {
      siteMetadata {
        title
        description
        siteUrl
      }
    }
    allStoryWriterMarkdown {
      group(field: tags) {
        fieldValue
        totalCount
      }
    }
  }
`;
