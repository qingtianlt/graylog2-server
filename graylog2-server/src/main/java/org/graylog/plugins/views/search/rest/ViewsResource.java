/*
 * Copyright (C) 2020 Graylog, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the Server Side Public License, version 1,
 * as published by MongoDB, Inc.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * Server Side Public License for more details.
 *
 * You should have received a copy of the Server Side Public License
 * along with this program. If not, see
 * <http://www.mongodb.com/licensing/server-side-public-license>.
 */
package org.graylog.plugins.views.search.rest;

import com.google.common.collect.ImmutableMap;
import com.google.common.collect.Sets;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import io.swagger.annotations.ApiParam;
import org.apache.shiro.authz.annotation.RequiresAuthentication;
import org.graylog.plugins.views.audit.ViewsAuditEventTypes;
import org.graylog.plugins.views.search.Query;
import org.graylog.plugins.views.search.Search;
import org.graylog.plugins.views.search.SearchDomain;
import org.graylog.plugins.views.search.SearchType;
import org.graylog.plugins.views.search.views.ViewDTO;
import org.graylog.plugins.views.search.views.ViewService;
import org.graylog.plugins.views.search.views.WidgetDTO;
import org.graylog.security.UserContext;
import org.graylog2.audit.jersey.AuditEvent;
import org.graylog2.dashboards.events.DashboardDeletedEvent;
import org.graylog2.database.PaginatedList;
import org.graylog2.events.ClusterEventBus;
import org.graylog2.plugin.database.ValidationException;
import org.graylog2.plugin.database.users.User;
import org.graylog2.plugin.rest.PluginRestResource;
import org.graylog2.rest.models.PaginatedResponse;
import org.graylog2.search.SearchQuery;
import org.graylog2.search.SearchQueryField;
import org.graylog2.search.SearchQueryParser;
import org.graylog2.shared.rest.resources.RestResource;
import org.graylog2.shared.security.RestPermissions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.inject.Inject;
import javax.validation.Valid;
import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.NotNull;
import javax.ws.rs.BadRequestException;
import javax.ws.rs.DELETE;
import javax.ws.rs.DefaultValue;
import javax.ws.rs.GET;
import javax.ws.rs.NotFoundException;
import javax.ws.rs.POST;
import javax.ws.rs.PUT;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import java.util.Collection;
import java.util.Set;
import java.util.stream.Collectors;

import static java.util.Locale.ENGLISH;

@Api(value = "Views")
@Path("/views")
@Produces(MediaType.APPLICATION_JSON)
@RequiresAuthentication
public class ViewsResource extends RestResource implements PluginRestResource {
    private static final Logger LOG = LoggerFactory.getLogger(ViewsResource.class);
    private static final ImmutableMap<String, SearchQueryField> SEARCH_FIELD_MAPPING = ImmutableMap.<String, SearchQueryField>builder()
            .put("id", SearchQueryField.create(ViewDTO.FIELD_ID))
            .put("title", SearchQueryField.create(ViewDTO.FIELD_TITLE))
            .put("summary", SearchQueryField.create(ViewDTO.FIELD_DESCRIPTION))
            .build();

    private final ViewService dbService;
    private final SearchQueryParser searchQueryParser;
    private final ClusterEventBus clusterEventBus;
    private final SearchDomain searchDomain;

    @Inject
    public ViewsResource(ViewService dbService,
                         ClusterEventBus clusterEventBus, SearchDomain searchDomain) {
        this.dbService = dbService;
        this.clusterEventBus = clusterEventBus;
        this.searchDomain = searchDomain;
        this.searchQueryParser = new SearchQueryParser(ViewDTO.FIELD_TITLE, SEARCH_FIELD_MAPPING);
    }

    @GET
    @ApiOperation("Get a list of all views")
    public PaginatedResponse<ViewDTO> views(@ApiParam(name = "page") @QueryParam("page") @DefaultValue("1") int page,
                                            @ApiParam(name = "per_page") @QueryParam("per_page") @DefaultValue("50") int perPage,
                                            @ApiParam(name = "sort",
                                                      value = "The field to sort the result on",
                                                      required = true,
                                                      allowableValues = "id,title,created_at") @DefaultValue(ViewDTO.FIELD_TITLE) @QueryParam("sort") String sortField,
                                            @ApiParam(name = "order", value = "The sort direction", allowableValues = "asc, desc") @DefaultValue("asc") @QueryParam("order") String order,
                                            @ApiParam(name = "query") @QueryParam("query") String query) {

        if (!ViewDTO.SORT_FIELDS.contains(sortField.toLowerCase(ENGLISH))) {
            sortField = ViewDTO.FIELD_TITLE;
        }

        try {
            final SearchQuery searchQuery = searchQueryParser.parse(query);
            final PaginatedList<ViewDTO> result = dbService.searchPaginated(
                    searchQuery,
                    view -> isPermitted(ViewsRestPermissions.VIEW_READ, view.id())
                            || (view.type().equals(ViewDTO.Type.DASHBOARD) && isPermitted(RestPermissions.DASHBOARDS_READ, view.id())),
                    order,
                    sortField,
                    page,
                    perPage);

            return PaginatedResponse.create("views", result, query);
        } catch (IllegalArgumentException e) {
            throw new BadRequestException(e.getMessage(), e);
        }
    }

    @GET
    @Path("{id}")
    @ApiOperation("Get a single view")
    public ViewDTO get(@ApiParam(name = "id") @PathParam("id") @NotEmpty String id) {
        if ("default".equals(id)) {
            // If the user is not permitted to access the default view, return a 404
            return dbService.getDefault()
                    .filter(dto -> isPermitted(ViewsRestPermissions.VIEW_READ, dto.id()))
                    .orElseThrow(() -> new NotFoundException("Default view doesn't exist"));
        }

        final ViewDTO view = loadView(id);
        if (isPermitted(ViewsRestPermissions.VIEW_READ, id)
                || (view.type().equals(ViewDTO.Type.DASHBOARD) && isPermitted(RestPermissions.DASHBOARDS_READ, view.id()))) {
            return view;
        }

        throw viewNotFoundException(id);
    }

    @POST
    @ApiOperation("Create a new view")
    @AuditEvent(type = ViewsAuditEventTypes.VIEW_CREATE)
    public ViewDTO create(@ApiParam @Valid  @NotNull(message = "View is mandatory") ViewDTO dto, @Context UserContext userContext) throws ValidationException {
        if (dto.type().equals(ViewDTO.Type.DASHBOARD)) {
            checkPermission(RestPermissions.DASHBOARDS_CREATE);
        }

        validateIntegrity(dto);

        final User user = userContext.getUser();
        final ViewDTO savedDto = dbService.saveWithOwner(dto.toBuilder().owner(user.getName()).build(), user);
        return savedDto;
    }

    private void validateIntegrity(ViewDTO dto) {
        final Search search = searchDomain.getForUser(dto.searchId(), getCurrentUser(), this::hasViewReadPermission)
                .orElseThrow(() -> new BadRequestException("Search " + dto.searchId() + " not available"));

        final Set<String> searchQueries = search.queries().stream()
                .map(Query::id)
                .collect(Collectors.toSet());

        final Set<String> stateQueries = dto.state().keySet();

        if(!searchQueries.containsAll(stateQueries)) {
            final Sets.SetView<String> diff = Sets.difference(searchQueries, stateQueries);
            throw new BadRequestException("Search queries do not correspond to view/state queries, missing query IDs: " + diff);
        }

        final Set<String> searchTypes = search.queries().stream()
                .flatMap(q -> q.searchTypes().stream())
                .map(SearchType::id)
                .collect(Collectors.toSet());


        final Set<String> stateTypes = dto.state().values().stream()
                .flatMap(v -> v.widgetMapping().values().stream())
                .flatMap(Collection::stream)
                .collect(Collectors.toSet());

        if(!searchTypes.containsAll(stateTypes)) {
            final Sets.SetView<String> diff = Sets.difference(searchTypes, stateTypes);
            throw new BadRequestException("Search types do not correspond to view/search types, missing searches: " + diff);
        }

        final Set<String> widgetIds = dto.state().values().stream()
                .flatMap(v -> v.widgets().stream())
                .map(WidgetDTO::id)
                .collect(Collectors.toSet());

        final Set<String> widgetPositions = dto.state().values().stream()
                .flatMap(v -> v.widgetPositions().keySet().stream()).collect(Collectors.toSet());

        if(!widgetPositions.containsAll(widgetIds)) {
            final Sets.SetView<String> diff = Sets.difference(widgetPositions, widgetIds);
            throw new BadRequestException("Widget positions don't correspond to widgets, missing widget possitions: " + diff);
        }
    }

    private boolean hasViewReadPermission(ViewDTO view) {
        final String viewId = view.id();
        return isPermitted(ViewsRestPermissions.VIEW_READ, viewId)
                || (view.type().equals(ViewDTO.Type.DASHBOARD) && isPermitted(RestPermissions.DASHBOARDS_READ, viewId));
    }

    @PUT
    @Path("{id}")
    @ApiOperation("Update view")
    @AuditEvent(type = ViewsAuditEventTypes.VIEW_UPDATE)
    public ViewDTO update(@ApiParam(name = "id") @PathParam("id") @NotEmpty String id,
                          @ApiParam @Valid ViewDTO dto) {
        if (dto.type().equals(ViewDTO.Type.DASHBOARD)) {
            checkAnyPermission(new String[]{
                    ViewsRestPermissions.VIEW_EDIT,
                    RestPermissions.DASHBOARDS_EDIT
            }, id);
        } else {
            checkPermission(ViewsRestPermissions.VIEW_EDIT, id);
        }

        validateIntegrity(dto);

        return dbService.update(dto.toBuilder().id(id).build());
    }

    @PUT
    @Path("{id}/default")
    @ApiOperation("Configures the view as default view")
    @AuditEvent(type = ViewsAuditEventTypes.DEFAULT_VIEW_SET)
    public void setDefault(@ApiParam(name = "id") @PathParam("id") @NotEmpty String id) {
        checkPermission(ViewsRestPermissions.VIEW_READ, id);
        checkPermission(ViewsRestPermissions.DEFAULT_VIEW_SET);
        dbService.saveDefault(loadView(id));
    }

    @DELETE
    @Path("{id}")
    @ApiOperation("Delete view")
    @AuditEvent(type = ViewsAuditEventTypes.VIEW_DELETE)
    public ViewDTO delete(@ApiParam(name = "id") @PathParam("id") @NotEmpty String id) {
        checkPermission(ViewsRestPermissions.VIEW_DELETE, id);
        final ViewDTO dto = loadView(id);
        dbService.delete(id);
        triggerDeletedEvent(dto);
        return dto;
    }

    private void triggerDeletedEvent(ViewDTO dto) {
        if (dto != null && dto.type() != null && dto.type().equals(ViewDTO.Type.DASHBOARD)) {
            final DashboardDeletedEvent dashboardDeletedEvent = DashboardDeletedEvent.create(dto.id());
            //noinspection UnstableApiUsage
            clusterEventBus.post(dashboardDeletedEvent);
        }
    }

    private ViewDTO loadView(String id) {
        try {
            return dbService.get(id).orElseThrow(() -> viewNotFoundException(id));
        } catch (IllegalArgumentException ignored) {
            throw viewNotFoundException(id);
        }
    }

    private NotFoundException viewNotFoundException(String id) {
        return new NotFoundException("View " + id + " doesn't exist");
    }
}
