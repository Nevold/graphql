import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { createGqlResponseSchema, gqlResponseSchema } from './schemas.js';
import {
  graphql,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLNonNull,
  GraphQLList,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLInputObjectType,
  DocumentNode,
  parse,
  validate,
  GraphQLScalarType,
  GraphQLInt,
} from 'graphql';
import depthLimit from 'graphql-depth-limit';
import { MemberTypeId } from '../member-types/schemas.js';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { prisma } = fastify;

  const MemberTypeIdEnum = new GraphQLEnumType({
    name: 'MemberTypeId',
    values: {
      BASIC: { value: MemberTypeId.BASIC },
      BUSINESS: { value: MemberTypeId.BUSINESS },
    },
  });

  const UUID = new GraphQLScalarType({
    name: 'UUID',
    serialize(value) {
      return String(value);
    },
    parseValue(value) {
      return String(value);
    },
  });

  const MemberType = new GraphQLObjectType({
    name: 'MemberType',
    fields: () => ({
      id: { type: new GraphQLNonNull(MemberTypeIdEnum) },
      discount: { type: new GraphQLNonNull(GraphQLFloat) },
      postsLimitPerMonth: { type: new GraphQLNonNull(GraphQLFloat) },
    }),
  });

  const Post = new GraphQLObjectType({
    name: 'Post',
    fields: () => ({
      id: { type: new GraphQLNonNull(UUID) },
      title: { type: new GraphQLNonNull(GraphQLString) },
      content: { type: new GraphQLNonNull(GraphQLString) },
    }),
  });

  const Profile = new GraphQLObjectType({
    name: 'Profile',
    fields: () => ({
      id: { type: new GraphQLNonNull(UUID) },
      isMale: { type: new GraphQLNonNull(GraphQLBoolean) },
      yearOfBirth: { type: new GraphQLNonNull(GraphQLFloat) },
      memberType: {
        type: MemberType,
        resolve: (profile: { memberTypeId: string }) =>
          prisma.memberType.findUnique({ where: { id: profile.memberTypeId } }),
      },
    }),
  });

  const User = new GraphQLObjectType({
    name: 'User',
    fields: () => ({
      id: { type: new GraphQLNonNull(UUID) },
      name: { type: new GraphQLNonNull(GraphQLString) },
      balance: { type: new GraphQLNonNull(GraphQLFloat) },
      profile: {
        type: Profile,
        resolve: (user) => prisma.profile.findUnique({ where: { userId: user.id } }),
      },
      posts: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(Post))),
        resolve: (user) => prisma.post.findMany({ where: { authorId: user.id } }),
      },
      userSubscribedTo: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(User))),
        resolve: (user) =>
          prisma.user.findMany({
            where: {
              subscribedToUser: {
                some: { subscriberId: user.id },
              },
            },
          }),
      },
      subscribedToUser: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(User))),
        resolve: (user) =>
          prisma.user.findMany({
            where: {
              userSubscribedTo: {
                some: { authorId: user.id },
              },
            },
          }),
      },
    }),
  });

  const CreateUserInput = new GraphQLInputObjectType({
    name: 'CreateUserInput',
    fields: {
      name: { type: new GraphQLNonNull(GraphQLString) },
      balance: { type: new GraphQLNonNull(GraphQLFloat) },
    },
  });

  const CreateProfileInput = new GraphQLInputObjectType({
    name: 'CreateProfileInput',
    fields: {
      isMale: { type: new GraphQLNonNull(GraphQLBoolean) },
      yearOfBirth: { type: new GraphQLNonNull(GraphQLInt) },
      userId: { type: new GraphQLNonNull(UUID) },
      memberTypeId: { type: new GraphQLNonNull(MemberTypeIdEnum) },
    },
  });

  const CreatePostInput = new GraphQLInputObjectType({
    name: 'CreatePostInput',
    fields: {
      title: { type: new GraphQLNonNull(GraphQLString) },
      content: { type: new GraphQLNonNull(GraphQLString) },
      authorId: { type: new GraphQLNonNull(UUID) },
    },
  });

  const ChangeUserInput = new GraphQLInputObjectType({
    name: 'ChangeUserInput',
    fields: {
      name: { type: GraphQLString },
      balance: { type: GraphQLFloat },
    },
  });

  const ChangeProfileInput = new GraphQLInputObjectType({
    name: 'ChangeProfileInput',
    fields: {
      isMale: { type: GraphQLBoolean },
      yearOfBirth: { type: GraphQLFloat },
      memberTypeId: { type: MemberTypeIdEnum },
    },
  });

  const ChangePostInput = new GraphQLInputObjectType({
    name: 'ChangePostInput',
    fields: {
      title: { type: GraphQLString },
      content: { type: GraphQLString },
    },
  });

  const RootQueryType = new GraphQLObjectType({
    name: 'RootQueryType',
    fields: {
      memberTypes: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(MemberType))),
        resolve: () => prisma.memberType.findMany(),
      },
      memberType: {
        type: MemberType,
        args: {
          id: { type: new GraphQLNonNull(MemberTypeIdEnum) },
        },
        resolve: (_, { id }) => prisma.memberType.findUnique({ where: { id } }),
      },
      users: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(User))),
        resolve: () => prisma.user.findMany(),
      },
      user: {
        type: User,
        args: {
          id: { type: new GraphQLNonNull(UUID) },
        },
        resolve: (_, { id }) => prisma.user.findUnique({ where: { id } }),
      },
      posts: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(Post))),
        resolve: () => prisma.post.findMany(),
      },
      post: {
        type: Post,
        args: {
          id: { type: new GraphQLNonNull(UUID) },
        },
        resolve: (_, { id }) => prisma.post.findUnique({ where: { id } }),
      },
      profiles: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(Profile))),
        resolve: () => prisma.profile.findMany(),
      },
      profile: {
        type: Profile,
        args: {
          id: { type: new GraphQLNonNull(UUID) },
        },
        resolve: (_, { id }) => prisma.profile.findUnique({ where: { id } }),
      },
    },
  });

  const Mutations = new GraphQLObjectType({
    name: 'Mutations',
    fields: {
      createUser: {
        type: new GraphQLNonNull(User),
        args: {
          dto: { type: new GraphQLNonNull(CreateUserInput) },
        },
        resolve: (_, { dto }) => prisma.user.create({ data: dto }),
      },
      createProfile: {
        type: new GraphQLNonNull(Profile),
        args: {
          dto: { type: new GraphQLNonNull(CreateProfileInput) },
        },
        resolve: (_, { dto }) => prisma.profile.create({ data: dto }),
      },
      createPost: {
        type: new GraphQLNonNull(Post),
        args: {
          dto: { type: new GraphQLNonNull(CreatePostInput) },
        },
        resolve: (_, { dto }) => prisma.post.create({ data: dto }),
      },
      changeUser: {
        type: new GraphQLNonNull(User),
        args: {
          id: { type: new GraphQLNonNull(UUID) },
          dto: { type: new GraphQLNonNull(ChangeUserInput) },
        },
        resolve: (_, { id, dto }) => prisma.user.update({ where: { id }, data: dto }),
      },
      changeProfile: {
        type: new GraphQLNonNull(Profile),
        args: {
          id: { type: new GraphQLNonNull(UUID) },
          dto: { type: new GraphQLNonNull(ChangeProfileInput) },
        },
        resolve: (_, { id, dto }) => prisma.profile.update({ where: { id }, data: dto }),
      },
      changePost: {
        type: new GraphQLNonNull(Post),
        args: {
          id: { type: new GraphQLNonNull(UUID) },
          dto: { type: new GraphQLNonNull(ChangePostInput) },
        },
        resolve: (_, { id, dto }) => prisma.post.update({ where: { id }, data: dto }),
      },
      deleteUser: {
        type: new GraphQLNonNull(GraphQLString),
        args: {
          id: { type: new GraphQLNonNull(UUID) },
        },
        resolve: async (_, { id }) => {
          await prisma.user.delete({ where: { id } });
          return 'Deleted';
        },
      },
      deleteProfile: {
        type: new GraphQLNonNull(GraphQLString),
        args: {
          id: { type: new GraphQLNonNull(UUID) },
        },
        resolve: async (_, { id }) => {
          await prisma.profile.delete({ where: { id } });
          return 'Deleted';
        },
      },
      deletePost: {
        type: new GraphQLNonNull(GraphQLString),
        args: {
          id: { type: new GraphQLNonNull(UUID) },
        },
        resolve: async (_, { id }) => {
          await prisma.post.delete({ where: { id } });
          return 'Deleted';
        },
      },
      subscribeTo: {
        type: new GraphQLNonNull(GraphQLString),
        args: {
          userId: { type: new GraphQLNonNull(UUID) },
          authorId: { type: new GraphQLNonNull(UUID) },
        },
        resolve: async (_, { userId, authorId }) => {
          await prisma.subscribersOnAuthors.create({
            data: {
              subscriberId: userId,
              authorId,
            },
          });
          return 'Subscribed';
        },
      },
      unsubscribeFrom: {
        type: new GraphQLNonNull(GraphQLString),
        args: {
          userId: { type: new GraphQLNonNull(UUID) },
          authorId: { type: new GraphQLNonNull(UUID) },
        },
        resolve: async (_, { userId, authorId }) => {
          await prisma.subscribersOnAuthors.delete({
            where: {
              subscriberId_authorId: {
                subscriberId: userId,
                authorId,
              },
            },
          });
          return 'Unsubscribed';
        },
      },
    },
  });

  const schema = new GraphQLSchema({
    query: RootQueryType,
    mutation: Mutations,
  });

  fastify.route({
    url: '/',
    method: 'POST',
    schema: {
      ...createGqlResponseSchema,
      response: {
        200: gqlResponseSchema,
      },
    },
    async handler(req) {
      const { query, variables, operationName } = req.body as {
        query: string;
        variables?: Record<string, unknown>;
        operationName?: string;
      };

      let documentAST: DocumentNode;
      try {
        documentAST = parse(query);
      } catch (syntaxError) {
        return { errors: [syntaxError] };
      }

      const validationErrors = validate(schema, documentAST, [depthLimit(5)]);
      if (validationErrors.length > 0) {
        return { errors: validationErrors };
      }

      return graphql({
        schema,
        source: query,
        variableValues: variables,
        operationName,
        contextValue: { prisma },
      });
    },
  });
};

export default plugin;
