const _ = require('lodash')
const moment = require('moment')

module.exports = {
  /**
   * Description of the action goes here
   * @param  {String} params.name=value Description of the parameter goes here
   * @param  {Number} [params.age] Optional parameter
   */
  startGame: state => {
    return {
      ...state,
      count: 0,
      score: 0,
      startTime: new Date()
    }
  },

  endGame: state => {
    const totalTimeInMs = moment().diff(moment(state.startTime))
    const totalScore = parseInt(state.score / totalTimeInMs * 1000 * 5000)

    return {
      ...state,
      totalScore: totalScore
    }
  },

  amendLeaderboard: async (state, event) => {
    // Let's pull our existing leaderboard or create an empty board if it doesn't exist
    let board = (await event.bp.db.kvs.get('leaderboard')) || []

    board.push({
      score: state.totalScore,
      date: moment().format('dd MMM YYYY, hA'),
      nickname: state.nickname
    })

    // Now let's take the top 5 only and re-save it
    board = _.take(_.orderBy(board, ['score'], ['desc']), 5)
    await event.bp.db.kvs.set('leaderboard', board)

    // Are we in top 5? (i.e. are we in the array)
    const doesRanking = !!_.find(board, {
      score: state.totalScore,
      nickname: state.nickname
    })

    return {
      ...state,
      doesRanking: doesRanking
    }
  },

  sendRandomQuestion: async (state, event) => {
    // The `-random()` extension picks a random element in all the `trivia` Content Type
    // We also retrieve the message we just sent, notice that `event.reply` is asynchronous, so we need to `await` it
    const messageSent = await event.reply('#!trivia-random()')

    // find the good answer
    const goodAnswer = _.find(messageSent.context.choices, { payload: 'TRIVIA_GOOD' })

    return {
      ...state,
      isCorrect: null,
      count: state.count + 1,
      goodAnswer
    }
  },

  render: async (state, event, args) => {
    if (!args.renderer) {
      throw new Error('Missing "renderer"')
    }

    await event.reply(args.renderer, args)
  },

  renderLeaderboard: async (state, event) => {
    let board = (await event.bp.db.kvs.get('leaderboard')) || []
    await event.reply('#leaderboard', { leaderboard: board })
  },

  validateAnswer: (state, event) => {
    const isCorrect = state.goodAnswer && event.text === state.goodAnswer.text
    return { ...state, isCorrect, score: isCorrect ? state.score + 1 : state.score }
  },

  /**
   * @param {string} args.name - Name of the tag.
   * @param {string} args.value - Value of the tag.
   */
  setUserTag: async (state, event, { name, value }) => {
    await event.bp.users.tag(event.user.id, name, value)
    return { ...state }
  },

  getUserTag: async (state, event, { name, into }) => {
    const value = await event.bp.users.getTag(event.user.id, name)
    return { ...state, [into]: value }
  }
}
